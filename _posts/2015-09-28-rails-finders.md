---
layout:     post
title:      A Review of Rails Finders
date:       2015-09-28 12:32:18
author:     Yury Voloshin
summary:    A brief overview of finder methods in Rails
categories: Rails
tags:
 - Rails
---

I will try to make this the blog post I wish I read before I started working on [StormyKnights](http://stormy-knights.herokuapp.com), one of my most recent apps. It is all about how to write a finder statement in Rails. Finder statements are, as the name implies, commands that help us find the desired rows in a database table. As in many other aspects of Rails, there are several different ways of structuring a finder statement that will return the same result. I'll start with an example. When I was working on the StormyKnight chess game and had only a smattering of knowledge about finder statements, I used the line below to identify a white pawn in the game:

<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">white_pawn = game.pieces.where(x_coordinates: 1, y_coordinates: 1)</code>
 </pre>
</div>

This seemed to work well. Then the pawn made a move and code that updates its position in the database had to be executed: 
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">put :update, id: white_pawn1.id, x_coordinates: 1, y_coordinates: 3</code>
 </pre>
</div>

This gave me an error:
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">NoMethodError: undefined method `id' for       <ActiveRecord::AssociationRelation::ActiveRecord_AssociationRelation_Piece:0xbaa546b8></code>
 </pre>
</div>

Now inevitable questions came up: How can 'id' be an undefined method? And what's an Association Relation? A google search showed a quick solution to my problem: just add <code>.first</code> to the end of the statement, like this:

<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">white_pawn = game.pieces.where(x_coordinates: 1, y_coordinates: 1).first</code>
 </pre>
</div>
 
This time, it worked like a charm. But why? These questions were my motivation for looking into the details of Rails finders. Here's a summary of what I found in [Agile Web Development with Rails] (http://www.amazon.com/Agile-Development-Rails-Facets-Ruby/dp/1937785564) and in [Rails documentation] (http://api.rubyonrails.org/classes/ActiveRecord/FinderMethods.html).

Finder methods are located in the ActiveRecord module of Rails, which contains methods that make it possible for us to interact with the database without ever having learned a word of SQL. The simplest way of finding a row in a table is to use the <code>find()</code> method. This method takes the id of the object we're searching for as an argument. For example, game.pieces.find(5) will return a piece with id of 5. However, usually we don't know the id of our model objects and instead we need to use their attributes as parameters. Passing search parameters to the  <code>find()</code> method can be done like this:

<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">spiderman = Superheroes.find_by(name: “Peter Parker”)</code>
 </pre>
</div>

We can also search through more than one database columns at the same time:
spiderman = Superheroes.find_by(name: “Peter Parker”, weapon: “spiderweb”)

Or, for better readability, we can write it like this:
spiderman = Superheroes.find_by_name_and_weapon(“Peter Parker”, “spiderweb”)

As often happens in Ruby, the two statements above return exactly the same result and the one you use depends entirely on your personal preference. 
An alternate search method is <code>where()</code>. As we've seen in the example above, it is tempting to write
<code>white_pawn = game.pieces.where(x_coordinates: 1, y_coordinates: 1)</code>

When we <code>inspect()</code> the result of this statement, we get 

<ActiveRecord::AssociationRelation [#<Pawn id: 584, x_coordinates: 1, y_coordinates: 1, game_id: 19, created_at: "2015-09-27 22:59:10", updated_at: "2015-09-27 22:59:10", type: "Pawn", color: "white", image: "white-pawn.png", status: "active">]>

It returned an array! Since an array can't have an id, this explains the earlier error. On the other hand, 

<code>white_pawn = game.pieces.where(x_coordinates: 1, y_coordinates: 1).first</code>
and
<code>white_pawn = game.pieces.find_by(x_coordinates: 1, y_coordinates: 1)</code>
both return a single object, as expected:

<Pawn id: 584, x_coordinates: 1, y_coordinates: 1, game_id: 19, created_at: "2015-09-28 05:22:03", updated_at: "2015-09-28 05:22:03", type: "Pawn", color: "white", image: "white-pawn.png", status: "active">



<code>white_pawn = game.pieces.find_by(x_coordinates: 10, y_coordinates: 1)</code>
<code>white_pawn = game.pieces.where(x_coordinates: 10, y_coordinates: 1).first</code>
return nil

<code>white_pawn = game.pieces.where(x_coordinates: 10, y_coordinates: 1)</code>
returns
<code><ActiveRecord::AssociationRelation []></code>

find() raises an exception when record is not found because we imply that we expect it to exist. On the other hand, find_by() looks for a match. Since we're not sure that the match exists, it does not raise an exception if record is not found. Instead, it returns nil.  
