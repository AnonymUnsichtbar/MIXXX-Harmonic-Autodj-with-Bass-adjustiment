# MIXXX-Harmonic-Autodj-with-Bass-adjustiment
Mixxx Script for the Autodj that adjusts the Bass while mixing to ensure that the drums of the current track are quiet while transitioning.

Forked from https://github.com/lrq3000/musical_stuff/tree/main/Mixxx/AutoDJ/HarmonicAutoDJ

Full discussion on https://mixxx.discourse.group/t/auto-dj-extension-for-beatmatching-and-harmonic-mixing/15962/34

How to use? In Mixxx go to Options>Prefrences>Controllers. Click on Open User Mapping Folder. A window from your file explorer should pop up. Copy the .js and .xml in here. You also need a MIDI loopback device. On Linux go to your terminal and execute with root: "modprobe snd_virmidi midi_devs=1". This should create a virtual Midi Device. Connect the Input with the output with some tool like qpwgraph. On Windows and Macos you probably need some kind of tool, just google how to make a Midi Loopback device on these Operating Systems. If you open Mixxx, under Controllers should be a device called VirMIDI_something (may be diffrent on your system). Load the midiAutoDJ Mapping and enable the device. Now everything should be good to go.

I give no warranty on this script. Use it on your own risk.
