##### TODO

* ✓ Create a readme.md
* ✓ Create a framework for initting a new repo
    * ✓ Initialize git2consul using that repo
    * ✓ Initialize git2consul using a repo already on disk
    * ✓ Initializing multiple repos at once
    * ✓ Initialize with an empty consul config but repos already on disk
* ✓ Create test cases around all git operations
    * ✓ Add
        * ✓ On pull
        * ✓ On clone
    * ✓ Delete
    * ✓ Move
    * ✓ Move to subfolder
    * ✓ Type change
* ✓ Create concurrency test case
    * ✓ Signal several concurrent gitpokes, validate that branch updates are serial
    * ✓ Validate that passing in refs out of order does not lead to inconsistent end state
* ✓ Create test cases around file names
    * ✓ Space
    * ✓ Semicolon
    * ✓ Colon
    * ✓ Backslash
    * ✓ Exclamation point
* ✓ Create boundary check test cases
    * ✓ Test keys with values above 512kB
* ✓ Test config validation
    * ✓ repo
        * ✓ git repos do not have the same names
        * ✓ no duplicate branches in a repo
    * ✓ hooks
        * ✓ stash hook
        * ✓ github hook
        * ✓ polling hook
