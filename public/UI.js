/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import { extractFileName, clearSelected, clearGrid, buildGetRequest } from './util.js';
import { tryGetNewTracks, fetchCues, getMasterDeck } from './trackManagement.js';
import {updateSelectedSongUI, updateTransitionList, displayDetails} from './songList.js';
import { createDialog } from './confirmDialog.js';

/* Populate UI */
export function createCueButtons(cues, container, trackIdentifier) {
  const innerGridContainer = document.createElement('div');
  innerGridContainer.className = "cue-grid";
  container.appendChild(innerGridContainer);

  // Create default cue buttons: Start, Drop1, End
  const defaultCues = [
    { name: "Start", pos: 0 },
    { name: "Drop1", pos: null },
    { name: "End", pos: 0 }
  ];
  
  // Create container for default cues
  const defaultCuesContainer = document.createElement('div');
  defaultCuesContainer.className = 'default-cues-container';
  // Populate default cues
  defaultCues.forEach(cue => {
    const btn = document.createElement('button');
    btn.textContent = cue.name;
    btn.className = 'btn btn-secondary default-cue-button';
    btn.addEventListener('click', e => handleCueSelection(e, cue.name, trackIdentifier));
    defaultCuesContainer.appendChild(btn);
  });
  // Create clear button, place within default cues container
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'CLEAR';
  clearBtn.className = 'btn btn-danger clear-cue-button';
  clearBtn.addEventListener('click', () => clearSelectedCues(trackIdentifier));
  defaultCuesContainer.appendChild(clearBtn);

  // Create VDJ cues
  cues.forEach(cue => {
    const btn = document.createElement('button');
    btn.className = `btn btn-primary square-btn cue-button`;
    btn.textContent = cue?.name || "N/A";
    if (!cue) {
      btn.disabled = true;
      btn.classList.add('disabled');
    }else{
      btn.addEventListener('click', e => handleCueSelection(e, cue.name, trackIdentifier, cue.pos));
    }    
    innerGridContainer.appendChild(btn);
  });

  container.appendChild(defaultCuesContainer); // Append default cues
}

function handleCueSelection(event, cueName, trackIdentifier, cuePos = null) {
  // If the same cue is selected twice, do nothing
  if(transitionInfo[trackIdentifier].cue1.name == cueName 
    || transitionInfo[trackIdentifier].cue2.name == cueName) {
      return; 
  }
  // if two cues are already selected, then clear selection
  if(transitionInfo[trackIdentifier].cue1.name && transitionInfo[trackIdentifier].cue2.name) {
    // Deselect all other buttons
    clearSelected(event.currentTarget.parentElement);
    clearSelectedCues(trackIdentifier);
  }

  // Highlight the selected button
  event.currentTarget.classList.add('selected');
  event.currentTarget.selected = true;

  // Update the transitionInfo object based on which cue is being selected
  if (!transitionInfo[trackIdentifier].cue1.name) {
    transitionInfo[trackIdentifier].cue1 = { name: cueName, pos: cuePos };
  } else {
    transitionInfo[trackIdentifier].cue2 = { name: cueName, pos: cuePos };
  }
}

function clearSelectedCues(trackIdentifier) {
  // Clear selections from the UI
  const grid = trackIdentifier === 'track1' ? track1CuesGrid : track2CuesGrid;
  clearSelected(grid);

  // Reset the cue selections in the transitionInfo object
  transitionInfo[trackIdentifier].cue1 = { name: null, pos: null };
  transitionInfo[trackIdentifier].cue2 = { name: null, pos: null };
}

export function createTransitionButtons(transitions, container) {
  transitions.forEach(transition => {
    let btn = document.createElement('button');
    btn.className = `btn btn-primary rectangle-btn`;

    btn.addEventListener('click', e => {
      // Clear existing selections in the container
      clearSelected(container);
      // Mark the clicked button as selected
      e.target.classList.add('selected');
      
      // Hide the transition grid
      transitionTypeGrid.style.display = "none";

      // Show the modifier grid  
      createModifierButtons(modifiers[transition], transition); 

      transitionInfo["transition"] = transition;
      btn.selected = true;
    });

    btn.innerText = transition;
    container.appendChild(btn);
  });
}

function createModifierButtons(modifiers, transition) {
  modifiersGrid.innerHTML = ""; // Clear existing buttons
  modifiersGrid.style.display = "block";
  const modifierTitle = document.getElementById("modifierTitle");
  modifierTitle.innerText = transition+" Modifiers";
  modifierTitle.style.display = "block";

  modifiers.forEach(modifier => {
    let btn = document.createElement('button');
    btn.className = `btn btn-primary rectangle-btn`;
    
    btn.addEventListener('click', e => {
      if (btn.selected) {
        e.target.classList.remove('selected');
        btn.selected = false;
        const index = transitionInfo["modifiers"].indexOf(modifier);
        if (index > -1) {
          transitionInfo["modifiers"].splice(index, 1);
        }
      } else {
        e.target.classList.add('selected');
        btn.selected = true;
        if(!transitionInfo["modifiers"]) transitionInfo["modifiers"] = [];
        transitionInfo["modifiers"].push(modifier);
      }
    });

    btn.innerText = modifier;
    modifiersGrid.appendChild(btn);
  });
  
  // Modifiers grid cancel button
  const cancelButton = document.createElement('button');
  cancelButton.className = 'btn btn-danger rectangle-btn';
  cancelButton.innerText = 'Cancel';
  cancelButton.addEventListener('click', () => {
    // Clear selected modifiers
    transitionInfo["modifiers"] = [];
    
    // Hide the modifier grid and show the transition grid
    modifiersGrid.style.display = "none";
    modifierTitle.style.display = "none";
    transitionTypeGrid.style.display = "block";
  });
  modifiersGrid.appendChild(cancelButton);
}
/**/


/* Manipulate UI */

// Update UI with new trackQueue values
export function updateUI() {
  track1Element.innerText = transitionInfo.track1.path ? extractFileName(transitionInfo.track1.path) : "N/A";
  track2Element.innerText = transitionInfo.track2.path ? extractFileName(transitionInfo.track2.path) : "N/A";
  clearGrid(track1CuesGrid);
  clearGrid(track2CuesGrid);
  
  createCueButtons(track1Cues, track1CuesGrid, "track1"); 
  createCueButtons(track2Cues, track2CuesGrid, "track2");
}
/**/


/* Interactions/handlers */
export async function refreshTracks() {
  try {
    await tryGetNewTracks()
  
    // Call refresh_database endpoint
    const refreshResponse = await fetch('/refresh_database');
    if (refreshResponse.ok) {
      // Fetch new cue points for both tracks
      track1Cues = await fetchCues(transitionInfo.track1.path);
      track2Cues = await fetchCues(transitionInfo.track2.path);
      
      // Update UI to reflect new cue points
      updateUI();
      
      const masterDeck = await getMasterDeck();
      const masterSong = masterDeck === 1 ? transitionInfo.track1.path : transitionInfo.track2.path;
      await updateTransitionList(masterSong);
    }
  } catch (error) {
    console.error('Error in refreshing tracks:', error);
  }
}

/* Handlers */
export const saveTransitionHandler = async () => {
  try {
    transitionInfo.comment = commentBox.value;

    // Show confirmation dialog before saving
    const ratingComment = await createDialog(transitionInfo);
    transitionInfo.rating = ratingComment.rating;
    transitionInfo.comment = ratingComment.comment;

    // If confirmed, proceed with saving
    const savedTrack = (transitionInfo.direction === "left_to_right") ? transitionInfo.track1.path : transitionInfo.track2.path;

    const preparedTransitionInfo = prepareTransitionInfoForSave(transitionInfo);
    const response = await fetch('save_transition', buildGetRequest(preparedTransitionInfo));

    if (response.ok) {
      const data = await response.text();
      console.log('Response:', data);
      saveTransitionButton.textContent = "Transition Saved!";
      setTimeout(() => saveTransitionButton.textContent = "Save Transition", 2000);

      toggleDirection();
      clearTransitionInfo();
      await updateTransitionList(savedTrack);
      await displayDetails(transitionInfo);

    } else {
      console.error('Failed to save transition: HTTP status ' + response.status);
    }
  } catch (error) {
    console.error('Transition saving cancelled:', error.message);
    console.error(error.stack); 
    // Handle cancellation (do not clear transitionInfo, do not save transition)
  }
};

//todo: Still trying to figure out what should I reset within transitionInfo after saving

export function toggleDirection() {
  const transitionArrow = document.getElementById('transitionArrow');
  const toggleDirectionButton = document.getElementById('toggleDirectionButton');

  if (transitionInfo.direction === 'left_to_right') {
    transitionInfo.direction = 'right_to_left';
    transitionArrow.textContent = '🡄';  // Leftwards arrow
    toggleDirectionButton.textContent = '🡄';  // Leftwards arrow
  } else {
    transitionInfo.direction = 'left_to_right';
    transitionArrow.textContent = '🡆';  // Rightwards arrow
    toggleDirectionButton.textContent = '🡆';  // Rightwards arrow
  }

  // Double-check to ensure the UI and transitionInfo.direction are in sync
  if ((transitionInfo.direction === 'left_to_right' && transitionArrow.textContent !== '🡆') ||
      (transitionInfo.direction === 'right_to_left' && transitionArrow.textContent !== '🡄')) {
    console.error('Mismatch between transitionInfo.direction and the UI arrow. Resolving...');
    // Resolve the mismatch by updating transitionInfo to match the UI
    transitionInfo.direction = (transitionArrow.textContent === '🡆') ? 'left_to_right' : 'right_to_left';
  }
}

export function handleArrowKeys(e) {
  switch(e.keyCode) {
      case 38: // Up arrow
          if (selectedIndex > 0) {
              selectedIndex--;
          }
          break;
      case 40: // Down arrow
          if (selectedIndex < songList.length - 1) {
              selectedIndex++;
          }
          break;
      default:
          return; // Exit the function for other keys
  }

  updateSelectedSongUI();
}

export function handleMouseScroll(e) {
  if (e.deltaY < 0) { // Scrolling up
      if (selectedIndex > 0) {
          selectedIndex--;
      }
  } else if (e.deltaY > 0) { // Scrolling down
      if (selectedIndex < songList.length - 1) {
          selectedIndex++;
      }
  }

  updateSelectedSongUI();
}

export async function findPathsHandler() {
  const masterTrack = await getMasterDeck();

  const body = {
    masterSong: masterTrack === 1 ? transitionInfo.track1.path : transitionInfo.track2.path
  };

  try {
    const response = await fetch('/find_paths', buildGetRequest(body));

    if (response.ok) {
      const data = await response.text();
      console.log('Response:', data);
      // TODO: Handle the successful response, like updating the UI or showing a message to the user.
    } else {
      console.error('Failed to find paths: HTTP status ' + response.status);
      // TODO: Handle the error, maybe show an error message to the user.
    }

  } catch (error) {
    console.error('Error in findPathsHandler:', error);
    // TODO: Handle the exception, maybe show an error message to the user.
  }
}

function clearTransitionInfo() {
  transitionInfo.modifiers = [];
  transitionInfo.comment = null;
  transitionInfo.track1.cue1 = { name: null, pos: null };
  transitionInfo.track1.cue2 = { name: null, pos: null };
  transitionInfo.track2.cue1 = { name: null, pos: null };
  transitionInfo.track2.cue2 = { name: null, pos: null };
  commentBox.value = '';
}

function prepareTransitionInfoForSave(transitionInfo) {
  return {
      track1Path: transitionInfo.track1.path,
      track2Path: transitionInfo.track2.path,
      track1Cue: transitionInfo.track1.cue1.name,
      track2Cue: transitionInfo.track2.cue1.name,
      track1Cue2: transitionInfo.track1.cue2.name,
      track2Cue2: transitionInfo.track2.cue2.name,
      track2Cue1Pos: transitionInfo.track2.cue1.pos,
      track2Cue2Pos: transitionInfo.track2.cue2.pos,
      track1Cue1Pos: transitionInfo.track1.cue1.pos,
      track1Cue2Pos: transitionInfo.track1.cue2.pos,
      transition: transitionInfo.transition,
      direction: transitionInfo.direction,
      modifiers: transitionInfo.modifiers,
      comment: transitionInfo.comment,
      rating: transitionInfo.rating
  };
}
/**/