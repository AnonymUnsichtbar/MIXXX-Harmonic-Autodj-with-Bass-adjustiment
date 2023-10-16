/*
	midiAutoDJ
	License: GPLv2 or GPLv3, at your discretion
	 Author: Sophia Herzog, 2016-2017
             Stephen Larroque, 2021 (update compatibility to Mixxx v2.3.0)

	Using MIDI scripting to improve automatic DJ function:
		- sync bpm of decks
		- sync key of decks
		- select suitable tracks according to
			* difference in BPM
			* difference in key

	Usage:
	 1. Configure script options to your liking (see below)
     2. Install a virtual midi port/controller, eg, loopMIDI on Windows.
	 3. Navigate to Options, Preferences, Controllers
        * in the main panel, click on Open User Mapping Folder button. Unzip the .js and .xml files inside this folder.
        * select on the left side panel the virtual midi port you just created.
     4. In the Load Mapping dropdown selector, select midiAutoDJ.
	 5. Check that the checkbox Enabled is checked.
	 6. [Apply], [OK]
	 7. Restart Mixxx
	 8. Use Auto DJ as usual.
        * Tweak the parameters in this script as necessary. One way to know if it works is to drop one fast tempo music, start autodj, then try to load a much slower tempo music (more than 12 BPM of difference), then Auto DJ should by default remove it. Adjust the parameters as necessary to deal with this situation as you wish.

	Notes and Troubleshooting:
	 * When     using the Quick Effects fade, in Mixxx preferences, try to set Crossfader to
           Slow fade/Fast cut (additive), with  half logarithmic / scratching value
	 * When not using the Quick Effects fade, in Mixxx preferences, try to set Crossfader to
           Constant power,                with fully linear      / mixing     value
	 * The script starts / pauses / resumes automatically, when you enable / disable Auto DJ
	 * For initially setting the fader, the script assumes two empty decks, fades to Channel1
	 * If no next track is found or tracks are skipped before being properly displayed,
	   try to increase midiAutoDJ.refineDuration in Advanced Options
	 * If synchronising BPM, phase or key appears to lack sufficient time or does not find a beat,
	   try to increase Auto DJ fade duration in Mixxx (30 seconds is usually fine), and
	   try to decrease midiAutoDJ.sleepDuration in Advanced Options below.
	 * First, let Mixxx analyse your library for BPM and key
     * Helpful resources to update compatibility in the future: https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting and https://github.com/mixxxdj/mixxx/wiki/Midi-Controller-Mapping-File-Format and get inspiration from other user custom mappings on the forum.
	 * Set AutoDJ transition to "Fade to Outro" and 30s for best results.
	 * Set BPM detection to variable tempo (disable assume constant tempo) in preferences.
	 * Sync disabling was disabled in the script, because the script often failed to activate sync for some reason. Once the script activates syncing, the decks will stay synced forever, until autodj is turned off.
	 * On Windows, create 2 different loopback devices with two different softwares (eg, loopMIDI and LoopBe1) and set them both to midiAutoDJ controller. This will allow to avoid the script failing to get inputs and stopping to work transitions for some reason.
*/

var midiAutoDJ = {};

// Basic Options
midiAutoDJ.maxBpmAdjustment = 300;   // Maximum adjustment of BPM allowed for beats to sync
                                    // Note the difference of both tracks BPMs may be twice as much,
                                    // by matching two beats to one beat, where appropriate. This
                                    // allows for greater genre permeability and inclusion of half-
                                    // or double-time tracks
                                    // Unit: BPM, Integer; Range: 0 to MaxInt; Default: 12

midiAutoDJ.bpmSync = 1;             // Toggles if BPM and beat phase are to be synced (1) or not (0).
                                    // Unit: Binary

midiAutoDJ.bpmSyncFade = 1;         // Toggles if BPM is to be synchronised slowly (1) during approximately the
                                    // first two thirds of crossfading, or if it is to be adjusted abruptly (0)
                                    // at the first beat found.
                                    // Requires bpmSync to be enabled (1).
                                    // Unit: Binary

midiAutoDJ.adaptiveBpmSearch = 0;   // Try to find a song which matches current BPM very closely (1),
                                    // or allow maxBpmAdjustment right from the start (0).
                                    // After skipping skipsTillSurrender songs, the acceptable
                                    // BPM difference is raised 1/3 of maxBpmAdjustment until
                                    // maxBpmAdjustment is reached.
                                    // Unit: Binary

midiAutoDJ.shuffleAfterSkip = 0;    // Shuffle Auto-DJ queue after skipping a track.
                                    // When using a fixed set of tracks without manual intervention,
                                    // some tracks may be unreachable, due to having an unfortunate
                                    // place in the queue ordering. This solves the issue.
                                    // Unit: Binary

midiAutoDJ.skipsTillSurrender = 0; // Number of times to skip a track before resorting to
                                    // shuffling and increasing allowed BPM difference.
                                    // Reduces load on Mixxx, allowing for smoother operation.
                                    // Unit: Integer; Range: 1 to MaxInt; Default: 24

midiAutoDJ.careAboutKey = 0;        // Toggles if key is to be taken into account (1),
                                    // or if key should be ignored (0),
                                    // when selecting the next track.
                                    // Unit: Binary

midiAutoDJ.adjustKey = 0;           // Toggles if key should be adjusted (1),
                                    // or if key should stay untouched (0),
                                    // when fading a deck out.
                                    // Unit: Binary

midiAutoDJ.fadeQuickEffect = 1;     // Toggles if Quick Effect filter should be faded (1).
                                    // or if it should stay untouched (0).
                                    // Unit: Binary

midiAutoDJ.reverseQuickEffect = 0;  // Toggles direction of Quick Effect fade.
                                    // 0: Fade out to  left, fade in from right.
                                    // 1: Fade out to right, fade in from  left.
                                    // Unit: Binary

midiAutoDJ.fadeRange = 0.25;         // Decide how far the Quick Effects knob should turn
                                    // 0.0: No fade at all
                                    // 0.5: Fade out to 25%, fade in from 75%
                                    // 1.0: Fade out to  0%, fade in from 100%
                                    // Unit: Float; Range: 0.0 to 1.0; Default: 0.5
midiAutoDJ.lowChangeRate = 0.1;     // Decide how fast the low knob should turn left while transitioning
                                    // 0.0 Does not turn left at all
                                    // 1.0: Turns to the far left instantly
                                    // Unit: Float; Range: 0.0 to 1.0; Default: 0.5									

// Advanced Options
midiAutoDJ.refineDuration = 500; // Duration of sleeping between two track skips.
                                  // If Mixxx appears to hang or be overwhelmed when searching
                                  // for the next track, increase this value.
                                  // Note: Must NOT be smaller than midiAutoDJ.sleepDuration
                                  // Unit: Milliseconds; Default: 1000
midiAutoDJ.sleepDuration = 200;   // Duration of sleeping between actions.
                                  // Try to keep it low for best results.
                                  // Too low values might cause Mixxx to appear to hang.
                                  // Unit: Milliseconds; Default: 250

// Note to developers: Indent with tabs, align with spaces.
// JSHint configuration block:
/* jshint curly: true, eqeqeq: true, forin: true, freeze: true, futurehostile: true, latedef: true, nocomma: true, nonew: true, shadow: outer, singleGroups: true, strict: implied, undef: true, unused: true */
/* globals engine: false */

// Global Variables
midiAutoDJ.sleepTimer = 0; // 0 signifies a beginTimer error
midiAutoDJ.connected = 0;  // 0 signifies disconnected state
midiAutoDJ.syncing = 0;    // 1 signifies Mixxx should be trying to sync both decks
midiAutoDJ.skips = 0;      // Counts skips since last shuffle
midiAutoDJ.refineWait = 0; // Counts timer cycles since last track skip
midiAutoDJ.currMaxBpmAdj = midiAutoDJ.maxBpmAdjustment; // Current maximum BPM adjustment in adaptive search

// Functions
midiAutoDJ.init = function(id) { // Called by Mixxx
	id = 0; // Satisfy JSHint, but keep Mixxx function signature
	engine.setValue("[Channel1]", "quantize", 1.0);
	engine.setValue("[Channel2]", "quantize", 1.0);
	engine.setValue("[Channel1]", "keylock", 1.0);
	engine.setValue("[Channel2]", "keylock", 1.0);
	engine.setValue("[Channel1]", "keylockMode", 0.0);
	engine.setValue("[Channel2]", "keylockMode", 0.0);
	engine.setValue("[Master]", "crossfader", -1.0); // Assumes empty decks on Channel1 and Channel2; see Notes section above
    midiAutoDJ.syncConnection = engine.makeConnection("[AutoDJ]", "enabled", "midiAutoDJ.toggle")
	if (midiAutoDJ.syncConnection) {
		midiAutoDJ.connected = 1;
		midiAutoDJ.syncConnection.trigger();
	} else { // If connecting fails, this allows using the script anyway; least surprise.
		midiAutoDJ.sleepTimer = engine.beginTimer(midiAutoDJ.sleepDuration, "midiAutoDJ.main()");
	}
};

midiAutoDJ.shutdown = function(id) { // Called by Mixxx
	id = 0; // Satisfy JSHint, but keep Mixxx function signature
    var successful_disconnect = midiAutoDJ.syncConnection.disconnect();
	if (midiAutoDJ.connected && successful_disconnect) {
		midiAutoDJ.connected = 0;
	}
	if (midiAutoDJ.sleepTimer) {
		engine.stopTimer(midiAutoDJ.sleepTimer);
	}
};

midiAutoDJ.toggle = function(value, group, control) { // Called by signal connection
	group = 0;   // Satisfy JSHint, but keep Mixxx function signature
	control = 0; // Satisfy JSHint, but keep Mixxx function signature
	if (value) {
		midiAutoDJ.sleepTimer = engine.beginTimer(midiAutoDJ.sleepDuration, "midiAutoDJ.main()");
	} else if (midiAutoDJ.sleepTimer) {
		engine.stopTimer(midiAutoDJ.sleepTimer);
		midiAutoDJ.sleepTimer = 0;
	}
};

// Note: Technically, it would be cleaner to use signal connections instead of a timer.
//       However, I prefer keeping this simple; it's just a MIDI script, after all.
midiAutoDJ.main = function() { // Called by timer
	var prev = 1;
	var next = 2;
	var prevPos = engine.getValue("[Channel"+prev+"]", "playposition");
	var nextPos = engine.getValue("[Channel"+next+"]", "playposition");
	if (prevPos < nextPos) {
		var tmp = nextPos;
		nextPos = prevPos;
		prevPos = tmp;
		next = 1;
		prev = 2;
	}
	var nextPlaying = engine.getValue("[Channel"+next+"]", "play_indicator");

	var prevBpm = engine.getValue("[Channel"+prev+"]", "file_bpm");
	var nextBpm = engine.getValue("[Channel"+next+"]", "file_bpm");
	var diffBpm = Math.abs(nextBpm-prevBpm);
	var diffBpmDouble = 0; // diffBpm, with bpm of ONE track doubled
	// Note: Where appropriate, Mixxx will automatically match two beats of one.
	if (nextBpm < prevBpm) {
		diffBpmDouble = Math.abs(2*nextBpm-prevBpm);
	} else {
		diffBpmDouble = Math.abs(2*prevBpm-nextBpm);
	}

	// Next track is playing --> Fade in progress
	if (nextPlaying && nextPos > 0.0) { // play_indicator is falsely true, when analysis is needed and similar
		// Normalised crossfader variable to be used at several points below:
		if(this.lowChangeRate > 0){
			var eq = engine.getValue("[Channel"+prev+"]", "filterLow")
			engine.setValue("[Channel"+ prev +"]", "filterLow", eq-0.1);
			engine.setValue("[Channel"+ next +"]", "filterLow", 1);
		}
		var crossfader = engine.getValue("[Master]", "crossfader"); // Oscillates between -1.0 and 1.0
		crossfader = (crossfader+1.0)/2.0; // Oscillates between 0.0 and 1.0
		if ( next === 1 ) {
			crossfader = 1.0-crossfader; // Fades from 0.0 to 1.0
		}

		if ( midiAutoDJ.bpmSync ) {
			// Note: In order to get BPM to sync, but not key, and to get beats aligned nicely,
			//       I tried lots of variants with sync_enabled, sync_master, beatsync, beatsync_phase, beat_active, ...
			//       Nothing really worked well, except for the following abomination, which,
			//       at least, does the job somewhat okay-ish...
			// Note: Sometimes, Mixxx does not sync close enough for === operator
			if ( crossfader > 0.75 && midiAutoDJ.syncing ) { // 0.75 should leave at more than one midiAutoDJ.sleepDuration of time
				// Beat phases should be synchronised by now, so let's disable sync again
				midiAutoDJ.syncing = 0;
				if (midiAutoDJ.bpmSyncFade) {
					engine.setValue("[Channel"+next+"]", "sync_enabled", 2.0);
					//engine.setValue("[Channel"+next+"]", "sync_enabled", 0.0);
				} else {
					engine.setValue("[Channel"+prev+"]", "sync_enabled", 2.0); // Simulating short click of sync button...
					//engine.setValue("[Channel"+prev+"]", "sync_enabled", 0.0); // ...needs manual reset to work as expected
				}
				// Reset syncing modes before new track is loaded
				//engine.setValue("[Channel"+prev+"]", "sync_mode", 0.0);
				//engine.setValue("[Channel"+next+"]", "sync_mode", 0.0);
			} else if (crossfader < 0.75 && ! midiAutoDJ.syncing ) { // Synchronize BPM
				// Note midiAutoDJ.syncing prevents entering this case multiple times to avoid Mixxx jumping around madly in BPM doubling cases
				// Sync Modes: 0=None, 1=Follower, 2=Master; set follower before master, Mixxx would sanity-adjust it too late
				if (midiAutoDJ.bpmSyncFade) {
					midiAutoDJ.syncing = 1;
					engine.setValue("[Channel"+next+"]", "sync_mode", 1.0);
					engine.setValue("[Channel"+prev+"]", "sync_mode", 2.0);
					engine.setValue("[Channel"+next+"]", "sync_enabled", 1.0);
					//engine.setValue("[Channel"+next+"]", "sync_enabled", 0.0);
				} else if (engine.getValue("[Channel"+prev+"]", "beat_active")) { // Beat synchronise this case, sounds less harsh
					midiAutoDJ.syncing = 1;
					engine.setValue("[Channel"+prev+"]", "sync_mode", 1.0);
					engine.setValue("[Channel"+next+"]", "sync_mode", 2.0);
					engine.setValue("[Channel"+prev+"]", "sync_enabled", 1.0); // Simulating short click of sync button...
					//engine.setValue("[Channel"+prev+"]", "sync_enabled", 0.0); // ...needs manual reset to work as expected
				}
				// Sync is now enabled until disabled again
			}
			if ( midiAutoDJ.bpmSyncFade && midiAutoDJ.syncing ) {
				// This is not linear; incremental adjustments start and end slowly
				// Note: Must finish before crossfader = 0.75 because of the above code block
				var prevBpmCurrent=engine.getValue("[Channel"+prev+"]", "bpm");
				var adjustedBpm=prevBpmCurrent+0.25*crossfader*(nextBpm-prevBpmCurrent);
				if ( diffBpmDouble < diffBpm ) {
					if ( nextBpm < prevBpm ) {
						adjustedBpm=prevBpmCurrent+0.25*crossfader*(nextBpm*2-prevBpmCurrent);
					} else {
						adjustedBpm=prevBpmCurrent+0.25*crossfader*(nextBpm/2-prevBpmCurrent);
					}
				}
				engine.setValue("[Channel"+prev+"]", "bpm", adjustedBpm);
			}
		}

		if ( midiAutoDJ.adjustKey && crossfader > 0.75 && engine.getValue("[Channel"+prev+"]", "beat_active")) {
			// Delay key adjustment until past 75% of fading.
			var newKey = engine.getValue("[Channel"+next+"]", "key");
			engine.setValue("[Channel"+prev+"]", "key", newKey); // Mixxx handles the details; does [12+](key%12+1), too
		}
		if ( midiAutoDJ.fadeQuickEffect ) {
			var rangefader = crossfader*midiAutoDJ.fadeRange;          // Fades from 0.0 to fadeRange
			var fadeIn  = 0.5-rangefader/2.0+midiAutoDJ.fadeRange/2.0; // Fades from fadeRange to 0.5
			var fadeOut = 0.5-rangefader/2.0;                          // Fades from 0.5 to (1-fadeRange)
			if ( ! midiAutoDJ.reverseQuickEffect ) {
				engine.setValue("[QuickEffectRack1_[Channel"+prev+"]]", "super1", fadeOut);
				engine.setValue("[QuickEffectRack1_[Channel"+next+"]]", "super1", fadeIn );
			} else {
				engine.setValue("[QuickEffectRack1_[Channel"+prev+"]]", "super1", fadeIn );
				engine.setValue("[QuickEffectRack1_[Channel"+next+"]]", "super1", fadeOut);
			}
		}
	} else if (! nextPlaying) { // Next track is stopped --> Disable sync and refine track selection
		// This is supposed to reduce the chances of Mixxx being overwhelmed due to
		// too short midiAutoDJ.sleepDuration values by executing the following code only
		// once per midiAutoDJ.refineDelay at most. This allows fading to be smooth, without hanging GUI when
		// searching through large lists with shuffling.
		if ( midiAutoDJ.refineWait*midiAutoDJ.sleepDuration < midiAutoDJ.refineDuration ) {
			midiAutoDJ.refineWait++;
			return;
		} else {
			midiAutoDJ.refineWait = 0;
		}

		if (midiAutoDJ.bpmSyncFade) {
			// Avoid timestreching indefinitely due to ever so slight residual offset in BPM float
			engine.setValue("[Channel"+prev+"]", "bpm", prevBpm);
		}

		// Clean up in case previous transition did not finish nicely
		if ( midiAutoDJ.syncing ) {
			midiAutoDJ.syncing = 0;
			engine.setValue("[Channel"+prev+"]", "sync_mode", 0.0); // Disable sync, else loading new track...
			engine.setValue("[Channel"+next+"]", "sync_mode", 0.0); // ...or skipping tracks would break things.
			//engine.setValue("[Channel"+prev+"]", "sync_enabled", 0.0);
			//engine.setValue("[Channel"+next+"]", "sync_enabled", 0.0);
		}
		if ( midiAutoDJ.fadeQuickEffect ) {
			// To prepare for next fade
			engine.setValue("[QuickEffectRack1_[Channel"+next+"]]", "super1", 0.5+midiAutoDJ.fadeRange/2.0);
			// In case the transition ended to quickly
			engine.setValue("[QuickEffectRack1_[Channel"+prev+"]]", "super1", 0.5);
		}

		// Second, refine track selection
		// Key advantage of trial and error:
		//  * keeps code simple, Mixxx scripting is not made for this task
		//  * does not mess with Auto-DJ track source settings or queue ordering
		var skip = 0;
		if ( diffBpm > midiAutoDJ.currMaxBpmAdj && diffBpmDouble > midiAutoDJ.currMaxBpmAdj ) {
			skip = 1;
		}
		// Harmonic mixing by key:
		//   Mixxx internal numbering is based on Traditional key notation:
		//   Major keys: C = 1, Db = 2, D = 3, Eb     = 4, E = 5, F = 6, F#/Gb= 7, G = 8, Ab = 9, A =10, Bb =11, B =12.
		//   Minor keys: Cm=13, C#m=14, Dm=15, D#m/Ebm=16, Em=17, Fm=18, F#m  =19, Gm=20, G#m=21, Am=22, Bbm=23, Bm=24.
		//   Thus, we're fine if either
		//     1a difference is 0.0 (equal key)
		//     1b difference corresponds to harmonic switch of tonality, switching major and minor rings at same position in circle of fifths
		//     2  both are of same tonality (both major / both minor), and
		//     2a difference corresponds to neighbours in the circle of fifths (harmonic neighbours)
		//     2b difference corresponds to two  steps         clockwise in circle of fifths (energy mix)
		//     2c difference corresponds to five steps counter-clockwise in circle of fifths (energy mix)
		//   If neither is the case, we skip.
		if (midiAutoDJ.careAboutKey && ! skip) {
			skip = 1; // In this section, the default is to skip. Good cases are caught below
			var prevKey = engine.getValue("[Channel"+prev+"]", "key");
			var nextKey = engine.getValue("[Channel"+next+"]", "key");
			var diffKey = Math.abs(prevKey-nextKey);

			var smallKey = 0; // Prepend declaration to satisfy JSHint
			var largeKey = 0; // Prepend declaration to satisfy JSHint
			if (nextKey < prevKey) {
				smallKey = nextKey;
				largeKey = prevKey;
			} else {
				smallKey = prevKey;
				largeKey = nextKey;
			}

			if (diffKey === 0.0) { // 1a
				skip = 0;
			}
			if (smallKey < 13 && largeKey > 12 &&        // 1b
			    (smallKey < 4 && diffKey === 21.0 ||     // 1b
			     smallKey > 3 && diffKey ===  9.0   )) { // 1b
				skip = 0;
			}
			if (prevKey < 13 && nextKey < 13 ||    // 2
			    prevKey > 12 && nextKey > 12   ) { // 2
				if (diffKey === 5.0 || diffKey ===  7.0 ||    // 2a
				    diffKey === 2.0 || diffKey === 10.0 ||    // 2b
				    diffKey === 1.0 || diffKey === 11.0   ) { // 2c
					skip = 0;
				}
			}
		}
		if (skip) {
			engine.setValue("[AutoDJ]", "skip_next", 1.0);
			engine.setValue("[AutoDJ]", "skip_next", 0.0); // Have to reset manually
			midiAutoDJ.skips++;
			if (midiAutoDJ.skips === midiAutoDJ.skipsTillSurrender) {
				midiAutoDJ.skips = 0;
				if (midiAutoDJ.adaptiveBpmSearch && midiAutoDJ.currMaxBpmAdj < midiAutoDJ.maxBpmAdjustment-0.1 ) {
					// Substracting 0.1 in preceding if-clause to account for potential rounding / float errors
					midiAutoDJ.currMaxBpmAdj += midiAutoDJ.maxBpmAdjustment/4;
				}
				if (midiAutoDJ.shuffleAfterSkip) {
					engine.setValue("[AutoDJ]", "shuffle_playlist", 1.0);
					engine.setValue("[AutoDJ]", "shuffle_playlist", 0.0); // Have to reset manually
				}
			}
		} else { // Song selected
			if(this.lowChangeRate > 0){
				engine.setValue("[Channel"+ prev +"]", "filterLow", 1);
				engine.setValue("[Channel"+ next +"]", "filterLow", 1);
			}
			if (midiAutoDJ.adaptiveBpmSearch) {
				midiAutoDJ.currMaxBpmAdj = midiAutoDJ.maxBpmAdjustment/4;
			}
			var nextBpmAdjusted = nextBpm;
			if (midiAutoDJ.bpmSyncFade) {
				nextBpmAdjusted = prevBpm;
				if ( diffBpmDouble < diffBpm ) {
					if ( nextBpm < prevBpm ) {
						nextBpmAdjusted = prevBpm/2;
					} else {
						nextBpmAdjusted = prevBpm*2;
					}
				}
			}
			engine.setValue("[Channel"+next+"]", "bpm", nextBpmAdjusted); // Not inside if-clause to reset in any case
		}
	}
};
