---
layout:     post
title:      A Review of Rails Finders
date:       2015-09-28 12:32:18
author:     Yury Voloshin
summary:    A brief overview of finder methods in Rails
categories: Rails
tags:
 - finders
---

I will try to make this the blog post I wish I read before I started working on [StormyKnights](http://stormy-knights.herokuapp.com), one of my most recent apps. It is all about how to write a finder statement in Rails. Finder statements are, as the name implies, commands that help us find the desired rows in a database table. As in many other aspects of Rails, there are several different ways of structuring a finder statement that will return the same result. I'll start with an example. When I was working on the StormyKnights chess game and had only a smattering of knowledge about finder statements, I used the line below to identify a white pawn in the game:

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
  <code class="language-ruby" data-lang="ruby">NoMethodError: undefined method `id' for <ActiveRecord::AssociationRelation::ActiveRecord_AssociationRelation_Piece:0xbaa546b8></code>
 </pre>
</div>

Now inevitable questions came up: How can 'id' be an undefined method? And what's an AssociationRelation? A google search showed a quick solution to my problem: just add <code>.first</code> to the end of the statement, like this:

<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">white_pawn = game.pieces.where(x_coordinates: 1, y_coordinates: 1).first</code>
 </pre>
</div>
 
This time, it worked like a charm. But why? These questions were my motivation for looking into the details of Rails finders. Here's a summary of what I found in [Agile Web Development with Rails] (http://www.amazon.com/Agile-Development-Rails-Facets-Ruby/dp/1937785564) and in [Rails documentation] (http://api.rubyonrails.org/classes/ActiveRecord/FinderMethods.html).

Finder methods are located in the ActiveRecord module of Rails, which contains methods that make it possible for us to interact with the database without ever having learned a word of SQL. The simplest way of finding a row in a table is to use the <code>find()</code> method. This method takes the id of the object we're searching for as an argument. For example, game.pieces.find(5) will return a piece with id of 5. However, usually we don't know the id of our model objects and instead we need to use their attributes as parameters. Passing search parameters to the  <code>find()</code> method can be done by replacing <code>find()</code> with <code>find_by()</code> like this:

<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">spiderman = <i>Superheroes</i>.find_by(name: “Peter”)</code>
 </pre>
</div>

We can also search through more than one database columns at the same time:
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   spiderman = <i>Superheroes</i>.find_by(name: “Peter”, weapon: “spiderweb”)
  </code>
 </pre>
</div>


Or, for better readability, we can write it like this:
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   spiderman = <i>Superheroes</i>.find_by_name_and_weapon(“Peter”, “spiderweb”)
  </code>
 </pre>
</div>

As often happens in Ruby, the two statements above return exactly the same result and the one you use depends entirely on your personal preference. 
An alternate search method is <code>where()</code>. As we've seen in the example above, it is tempting to write
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   white_pawn = game.pieces.where(x_coordinates: 1, y_coordinates: 1)
  </code>
 </pre>
</div>

When we <code>inspect()</code> the result of this statement, we get 
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   ActiveRecord::AssociationRelation [Pawn id: 584, x_coordinates: 1, y_coordinates: 1, game_id: 19, created_at: "2015-09-27 22:59:10", updated_at: "2015-09-27 22:59:10", type: "Pawn", color: "white", image: "white-pawn.png", status: "active"]
  </code>
 </pre>
</div>

The result is an object belonging to the ActiveRecord::AssociationRelation class, and not an object of our Pieces class, as explained in [this StackOverflow post] (http://stackoverflow.com/questions/6004891/undefined-method-for-activerecordrelation). It is also an array. This explains the earlier error. On the other hand,
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   white_pawn = game.pieces.where(x_coordinates: 1, y_coordinates: 1).first
  </code>
 </pre>
</div>
and
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   white_pawn = game.pieces.find_by(x_coordinates: 1, y_coordinates: 1)
  </code>
 </pre>
</div>

both return a single record, as expected:

<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   Pawn id: 584, x_coordinates: 1, y_coordinates: 1, game_id: 19, created_at: "2015-09-28 05:22:03", updated_at: "2015-09-28 05:22:03", type: "Pawn", color: "white", image: "white-pawn.png", status: "active"
  </code>
 </pre>
</div>

To look into it a bit deeper, we can look up the documentation for <code>where()</code> and <code>find_by()</code> methods:

[<code>where()</code>] (http://www.rubydoc.info/docs/rails/4.1.7/ActiveRecord/QueryMethods#where-instance_method): Returns a new relation, which is the result of filtering the current relation according to the conditions in the arguments.

[<code>find_by()</code>] (http://www.rubydoc.info/docs/rails/4.1.7/ActiveRecord/FinderMethods#find_by-instance_method): Finds the first record matching the specified conditions.

Thus, adding <code>.first()</code> to the end of a <code>where()</code> statement transforms a collection into a single record. 

It is also worthwhile to look at what happens when a record is not found. Since we know that the tenth column of a chessboard cannot exist, we can <code>inspect</code> the output of the following find_by statement: 
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   white_pawn = game.pieces.find_by(x_coordinates: 10, y_coordinates: 1)
  </code>
 </pre>
</div>

It returns <code>nil</code>. We get the same result for 
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   white_pawn = game.pieces.where(x_coordinates: 10, y_coordinates: 1).first
  </code>
 </pre>
</div>

On the other hand, 
<div class = "highlight">
 <pre>
  <code class="language-ruby" data-lang="ruby">
   white_pawn = game.pieces.where(x_coordinates: 10, y_coordinates: 1)
  </code>
 </pre>
</div>

returns an empty array: <code>ActiveRecord::AssociationRelation []</code>
