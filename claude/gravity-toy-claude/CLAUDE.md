We will proceed forward carefully, step by step, one piece at a time, building the app up in complexity over many interations, similar to a living thing.   If there is too much complexity in a single step, give some choices for how break the task into smaller pieces and ask for guidance from the user on how to proceed. 

When adding new libraries to do work, begin by writing some throw-away code that can easily run in the main app, then easily deleted when it is shown to be good enough to accomplish what is needed. 

The overall architecture for this project is a reactjs application written in typescript.  Visual elements will each have their own class backed by a model class that uses mobx to communicate data changes.  Every class is to kept in it's own file.  

The code should be object-oriented to improve understanding of the architecture. 