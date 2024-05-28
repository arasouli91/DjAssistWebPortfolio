/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import { createAccessors } from './sharedState.js';
createAccessors();
import { extractFileName, clearSelected, clearGrid } from './util.js';
import { poll } from './trackManagement.js';
import { 
  refreshTracks, 
  toggleDirection, 
  findPathsHandler, 
  createTransitionButtons, 
  saveTransitionHandler, 
  handleArrowKeys, 
  handleMouseScroll  
} from './UI.js';



document.addEventListener('DOMContentLoaded', async () => {
  // get UI elements
  console.log("get track1 elem")
  track1Element = document.getElementById("track1");
  console.log("track1 elem: " + track1Element)
  track2Element = document.getElementById("track2");
  track1CuesGrid = document.getElementById('track1CueGrid');
  track2CuesGrid = document.getElementById('track2CueGrid');
  toggleDirectionButton = document.getElementById('toggleDirectionButton');
  toggleDirectionButton.addEventListener('click', toggleDirection);
  transitionTypeGrid = document.getElementById('transitionGrid');
  saveTransitionButton = document.getElementById('saveTransitionButton');
  modifiersGrid = document.getElementById("modifiersGrid");
  const refreshTracksButton = document.getElementById('refreshTracksButton');
  createTransitionButtons(transitions, transitionTypeGrid);
  saveTransitionButton.addEventListener('click', saveTransitionHandler);
  refreshTracksButton.addEventListener('click', refreshTracks);
  commentBox = document.getElementById('commentBox');
  const detailsPanel = document.getElementById('songDetails');
  songListContainer = document.getElementById('songList');
  songListContainer.addEventListener('mouseenter', function() {
      document.addEventListener('keydown', handleArrowKeys);
  });
  songListContainer.addEventListener('mouseleave', function() {
      document.removeEventListener('keydown', handleArrowKeys);
  });
  songListContainer.addEventListener('wheel', handleMouseScroll);
  const findPathsButton = document.getElementById('savePathsButton');
  findPathsButton.addEventListener('click', findPathsHandler);



  // Poll every 15 seconds
  setInterval(poll, 15000);

  // Initial render
  await poll();
});