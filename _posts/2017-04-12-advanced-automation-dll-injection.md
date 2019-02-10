---
layout:     post
title:      Advanced Automation with DLL Injection
date:       2017-04-12 15:19:00
author:     Jon Winsley
summary:    Advanced Automation with DLL Injection
categories: automation
tags:
 - c#
 - dll injection
 - hooks
---

Sometimes, you need to capture text from a window in a business application that doesn't export any controls to the Windows UI Automation or MSAA interfaces. You might be able to use OCR, depending on your toolkit, but what about when that fails?

We have two applications which both want to capture the same data. The vendor of Application A provided us with a tool that could capture the screen of Application B, parse out the keywords it needed, and enter them automatically in Application A. This worked great for a while, but something mysteriously changed and the OCR started capturing data unreliably. Most of the keywords would be correct, but every so often it would mis-translate part of an invoice number, sometimes so subtly that the end user didn't notice.

This, of course, became a major headache, and so the hunt for a resolution began. After testing a few different options, we decided to learn some new technologies and roll our own replacement.

## Hooking TextOuts

The screens of Application B, which had the data we needed to capture, were created with an in-house GUI framework that wasn't enabled for Microsoft's accessibility layer. This meant there weren't any documented automation hooks to find the data we needed. But we knew it was possible, because we had another scripting solution that could fetch that data, so we decompiled that scripting software to look for clues as to how it managed the trick.

After searching function calls on Google for a few hours one evening, we figured out that the scripting software was hooking some low-level rendering methods that Application B used to render its text into a bitmap for displaying on the screen. We experimented a bit and found that we could do the same with [EasyHook](http://easyhook.github.io/index.html), a .NET library that does most of the hard work on the back end. Copying from their [remote injection tutorial](http://easyhook.github.io/tutorials/nativeremotehook.html), we were able to create the main process and a DLL to inject into Application B.

It took a couple tries before we figured out the exact function used - [DrawTextA](https://msdn.microsoft.com/en-us/library/windows/desktop/dd162498(v=vs.85).aspx) - and set up an IPC client to send the captured text back to the main process.

## Coordinates and Double Buffering

But of course it couldn't be that easy: the coordinates our DrawTextA hook was sending back were all zeroes! It turns out that Application B was using double-buffering: writing the DrawTextA bitmap to a temporary device context, and then using [BitBlt](https://msdn.microsoft.com/en-us/library/windows/desktop/dd183370(v=vs.85).aspx) to write it to the screen. (This, it seems, is a common technique to prevent flickering.)

We needed the coordinates to tell where on the window each "textout" was being displayed (so we could find the coordinates we were looking for). After a bit more research, it turned out the solution was simple: we modified the injected DLL from the earlier tutorial to track the temporary DCs seen by our DrawTextA hook, and then hooked BitBlt to capture the target coordinates when those temporary DCs were copied to the screen. At that point we forwarded the text and the real coordinates to the main process:

```
// Textout hook captures the DrawText() call to render text to a bitmap.
// Captured text is stored (indexed by dc) in the DC_List hashtable
static bool TextOut_Hooked(
    IntPtr hdc,
    IntPtr lpchText,
    int nCount,
    [In, Out] ref RECT lpRect,
    uint uFormat)
{
    try
    {
        Main This = (Main)HookRuntimeInfo.Callback;
        
        lock (This.DC_List)
        {
            var textoutString = new StringBuilder();
            // Since it's a fixed-length string (not null-terminated), 
            // read it into the StringBuilder one character at a time.
            for (var i = 0; i < nCount; i++)
            {
                textoutString.Append((char)Marshal.ReadByte(lpchText, i));
            }
            // Add it to the list of tracked textout DCs
            This.DC_List[hdc] = textoutString;
        }
    }
    catch
    {
    }

    // call original API...
    return DrawTextA(
            hdc,
            lpchText,
            nCount,
            ref lpRect,
            uFormat);
}

// BitBlt hook captures the command to draw the rendered bitmap to the window
// Extracts the target coordinates and forwards them (along with the associated
// text) to the main process
static bool BitBlt_Hooked(
    IntPtr hdcDest,
    Int32 nXDest,
    Int32 nYDest,
    Int32 nWidth,
    Int32 nHeight,
    IntPtr hdcSrc,
    Int32 nXSrc,
    Int32 nYSrc,
    UInt32 dwRop)
{
    try
    {
        Main This = (Main)HookRuntimeInfo.Callback;

        lock (This.DC_List)
        {
            if (This.DC_List.ContainsKey(hdcSrc))
            {
                // Bingo! Capture the coordinates and build the
                // message for the main thread                        
                StringBuilder textoutString = new StringBuilder();
                textoutString.Append(" (");
                textoutString.Append(nXDest);
                textoutString.Append(",");
                textoutString.Append(nYDest);
                textoutString.Append(",");
                textoutString.Append(nWidth);
                textoutString.Append(",");
                textoutString.Append(nHeight);
                textoutString.Append(") ");
                textoutString.Append(This.DC_List[hdcSrc]);

                // Remove the tracked DC from the list
                This.DC_List.Remove(hdcSrc);

                // And queue up to send back to the main process
                This.Queue.Enqueue(textoutString.ToString());
            }
        }
    }
    catch
    {
    }

    // call original API...
    return BitBlt(
            hdcDest,
            nXDest,
            nYDest,
            nWidth,
            nHeight,
            hdcSrc,
            nXSrc,
            nYSrc,
            dwRop);
}
```

## Finding Targets

At this point the main process is receiving a list of strings that look something like this:

```
(100, 32, 57, 21) Invoice
```

It's a simple enough matter to [parse them out with a regex](https://regex101.com/). But how can we reliably identify the target fields we're looking for?

We decided that tracking just the x-y coordinates would be a bit too fragile - if the window dimensions changed, the position of the fields might be adjusted automatically. Instead, we specified regexes to match field labels that are always in the same position relative to the target, and recorded the offset to the textout we're looking for. Now, we can cycle through the list and find the most recent textout at those coordinates.

Because we don't have a way to recognize when the screen refreshes, these textouts can pile up and increase the risk of inaccuracy. We settled on a simple expedient: Whenever we recognized that a certain required field on the screen was blank, we cleared the textout list. Once the field was filled in, the textout list would populate appropriately.

So as to maximize the future extensibility of the tool, this configuration was recorded in an XML file:

```
<?xml version="1.0" encoding="utf-8"?>
<applications>
  <application exe="ApplicationB" id="AB">
    <match_title>Invoice Entry</match_title>
    <clear_condition x="197" y="214"/>
    <keywords>
      <keyword name="Invoice Type">
        <relative_to>
          <regex index="0">Invoice Type</regex>
          <position x="135" y="0" />
        </relative_to>
      </keyword>
      <keyword name="Invoice Date">
        <relative_to>
          <regex index="0">Invoice Date</regex>
          <position x="135" y="0" />
        </relative_to>
      </keyword>
      <keyword name="Vendor">
        <relative_to>
          <regex index="0">Vendor</regex>
          <position x="81" y="0" />
        </relative_to>
      </keyword>
      <keyword name="Invoice Number">
        <relative_to>
          <regex index="1">Invoice Number</regex>
          <position x="170" y="0" />
        </relative_to>
      </keyword>
    </keywords>
  </application>
</applications>
```

## Feeding Application A

So we've successfully extracted the target keywords from Application B. Time to figure out how to import them to Application A! This one *did* have support for Microsoft's UI Automation APIs, mostly - but the specific fields we needed were a custom control that wasn't enabled. Fooey.

Luckily Application A was designed to be very extensible, so they had a couple different API options. After experimenting, it became clear that the most seamless option was to run a VBScript internally that had access to those controls. The only difficulty was figuring out how to connect to an application running in the background to fetch that data.

## Inter-Process Communication

For all the options .NET has to allow processes to communicate, none of them were exactly trivial. We initially explored using a COM interface, but couldn't quite work out how to implement it on the background process. So we took a slightly more circuitous route.

We set up a memory-mapped file in the main process, which could be shared between processes. Here, we serialized the observed keywords (as defined in the config file, above). Although the main process supports monitoring multiple instances of Application B, we're only interested in the active (and hence most recent) window, so this memory-mapped file always contains the latest set of observed keywords, recalculated after every update from the injected DLLs.

VBScript, unfortunately, is very limited and does not support accessing memory-mapped files. It does support COM objects, however, so we created a [very minimal COM-enabled DLL](https://msdn.microsoft.com/en-us/library/c3fd4a20.aspx) for the sole purpose of interfacing with that memory-mapped file:

```
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;

namespace InvoiceAutomatorKeywords
{
    [Guid("EF118C70-55E9-40B5-A56D-5C190F1C6F61")]
    public interface KeywordLoaderInterface
    {
        bool fetchKeywords();
        string getKeyword(string keyword);
    }
    [Guid("9EA462F1-CB2A-43AA-B717-C5FDF4D826FF"),
        ClassInterface(ClassInterfaceType.None)]
    public class KeywordLoader : KeywordLoaderInterface
    {
        private Dictionary<string, string> _keywords = new Dictionary<string, string>();
        public bool fetchKeywords()
        {
            MemoryMappedFile keyword_file;
            try
            {
                keyword_file = MemoryMappedFile.OpenExisting("invoice_automator_keywords");
            }
            catch (FileNotFoundException)
            {
                // No keyword file open
                return false;
            }
            MemoryMappedViewStream stream = keyword_file.CreateViewStream();
            BinaryReader reader = new BinaryReader(stream);
            string keyword_string = reader.ReadString();
            string[] keyword_list = keyword_string.Split('^');
            foreach (string keyword_entry in keyword_list)
            {
                string[] keyword_array = keyword_entry.Split('|');
                if (keyword_array.Length == 2)
                {
                    //System.Windows.Forms.MessageBox.Show(keyword_entry);
                    _keywords[keyword_array[0]] = keyword_array[1];
                    //System.Windows.Forms.MessageBox.Show(keyword_array[1]);
                }
            }
            return true;
        }
        public string getKeyword(string keyword)
        {
            if (_keywords.ContainsKey(keyword))
            {
                return _keywords[keyword];
            }
            return "";
        }
    }
}
```

After a little finagling with the APIs, we got the VBScript working, and our prototype had a seamless one-click workflow that copied the fields perfectly. After some further testing and building an installer, we were ready for deployment!