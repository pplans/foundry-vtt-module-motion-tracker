# foundry-vtt-module-motion-tracker
A module giving life to the Alien RPG motion tracker in foundry VTT

The module installs a button just over the chat box that you can hit.
When hitted, the button will scan for the nearest active and visibles tokens based on the selected token.

## v0.1
* Migration Three JS -> PIXIjs taking advantage of the engine already in use inside Foundry VTT
* Added animations for both signals and background simulating periodic scan
* Added text giving distance of nearest ping detected
* Improved background texture, adding a frame for text + a red spot for origin
* Fixed a lot of bugs:
  * A taken right over the player is no longer detected
  * Improved resource loading

## v0.0.4
* fixes on player view streaming

## v0.0.3
* statuses affects the motion tracker scanner now
* motion tracker is renderer in a window and is now draggeable => removed settings to center and offset
* improved ping textures
* once the tracker is enabled, the origin remains the same and is streamed correctly

# v0.0.2
* resize

## v0.0.1
If you select another token the display will update.
Moving tokens will update the display also.
Clicking on the button again will hide the motion tracker.
The motion tracker is visible for everyone, there is an option in the settings to only allow having the button for the GM, but it won't update an UI already rendered so you have to kick your players out.

# Special thanks
Otakode - some indirect ideas and his feedbacks
Freki - pushing me around to make this happen and giving me a lot of ideas and feedbacks
Sasmira - a lot of feedbacks and contradictory ideas that are valued
Minarkhaios - fadeout
Foundry community, specially Alien RPG one
Some parts of the code may resemble to dice-so-nice sources, this project is actually based on dice-so-nice and tends to get as far as possible to it with time