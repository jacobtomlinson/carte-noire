(function(root, $, undefined) {
    // Legacy Private functions

    function getStartFontSize() {
        try {
            startingFontSize = parseInt($(document.getElementsByClassName("articles")[0].getElementsByTagName("a")[0]).css("font-size"));
            setFontSize();
            window.addEventListener('resize', setFontSize, true);
        } 
        catch (e) {            
        }
    }

    function setFontSize() {        
        var title, dateOfTitle, fontSizeOfTitle, listOfA, listOfSmall, listOfArticlesDiv, divWidth;
            
        listOfArticlesDiv = document.getElementsByClassName("articles");
            
        for (i = 0; i < listOfArticlesDiv.length; i++) {    
            listOfA = document.getElementsByClassName("articles")[i].getElementsByTagName("a");
            listOfSmall = document.getElementsByClassName("articles")[i].getElementsByTagName("small");
      
            divWidth = document.getElementsByClassName("articles")[i].offsetWidth;
      
            for (k = 0; k < listOfSmall.length; k++) {      
                title = $(listOfA[k]);
                dateOfTitle = $(listOfSmall[k]);
        
                fontSizeOfTitle = startingFontSize;
                title.css("font-size", fontSizeOfTitle);
        
                while (title.width() + dateOfTitle.width() >= divWidth)
                  title.css("font-size", fontSizeOfTitle -= 0.5);
            }
        }      
    }

    root.legacygetStartFontSize = function() {
        try {
            startingFontSize = parseInt($(document.getElementsByClassName("articles")[0].getElementsByTagName("a")[0]).css("font-size"));
            setFontSize();
            window.addEventListener('resize', setFontSize, true);
        } 
        catch (e) {            
        }
    }

    // This is the main functionality from the footer, just moved as-is.
    root.legacyInit = function() {   
        $("#my-menu").mmenu().on( "closed.mm", function() {
            $(".menu-button").show();
         });

        $(".menu-button").click(function() {
            $(".menu-button").hide();
            $("#my-menu").trigger("open.mm");
        });
    }
})(window, $);