﻿Minimaxr.js is a checkers game engine written in JavaScript (es6) and generally based on the minimax algorithm.

**Details**

Minimaxr.js builds on top of the general minimax algorithm with (configurable) advanced techniques such as:
* Progressive deepening
* Quiescence search 
* Alpha-beta pruning
* Analysis caching
* Singular extensions

 
**Background**

Minimaxr.js builds on research into computational intelligence I carried out while earning a CS degree in Computer Science in the early 2000s. The engine was originally written in Turbo Pascal, then ported to C++ and thence C#.

**Why JavaScript?**

As mentioned the original engine was written in compiled languags. Even though JavaScript is supposed to be a slower scripting language not suited for game engines, I chose to port Minimar to JavaScript in order to:

* Learn about the finer aspects of JavaScript regarding algorithmic hip-perf programming (including async, performance optimizations, etc.)
* Evaluate the comparative performance of JavaScript an an intepreted language. I am pleasantly suprised by the speed on the JS implemention, which rivals the implementations in compiled languages. This performance is no doubt partly due to the highly optimized engines developed for the language by the major browser vendors (e.g., Google's V8 and Microsoft's Chakra)
* Provide an easty way to run the engine with minimal installation and setup


**Staging**

The entire engine is contained in the minimaxr.js file. The test/index.html file contains a sample driver of the engine; load it in any modern browser to try the engine.

