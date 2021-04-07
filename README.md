# foundry-vtt-module-motion-tracker
A module giving life to the Alien RPG motion tracker in foundry VTT

The module installs a button just over the chat box that you can hit.
When hitted, the button will scan for the next active and visibles tokens based on the selected token.


## v0.0.3
- statuses affects the motion tracker scanner now
- motion tracker is renderer in a window and is now draggeable => removed settings to center and offset
- improved ping textures
- once the tracker is enabled, the origin remains the same and is streamed correctly

## v0.0.1
If you select another token the display will update.
Moving tokens will update the display also.
Clicking on the button again will hide the motion tracker.
The motion tracker is visible for everyone, there is an option in the settings to only allow having the button for the GM, but it won't update an UI already rendered so you have to kick your players out.

# credits
Some parts of the code may resemble to dice-so-nice sources, this project is actually based on dice-so-nice and tends to get as far as possible to it
