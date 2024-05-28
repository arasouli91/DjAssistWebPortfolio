
export let sharedState = {
  track1Cues: [],
  track2Cues: [],
  track1Element: null,
  track2Element: null,
  track1CuesGrid: null,
  track2CuesGrid: null,
  transitionTypeGrid: null,
  saveTransitionButton: null,
  toggleDirectionButton: null,
  commentBox: null,
  detailsPanel: null,
  masterDeck: null,
  modifiersGrid: null,
  selectedIndex: 0,
  transitionList: null,
  songListContainer: null,
  transitionInfo: {
    track1: {
      path: null,
      cue1: { name: null, pos: null },
      cue2: { name: null, pos: null }
    },
    track2: {
      path: null,
      cue1: { name: null, pos: null },
      cue2: { name: null, pos: null }
    },
    transition: null,
    modifiers: null,
    direction: 'left_to_right',
    comment: null,
    rating: null,
  },
  transitions: [
    'Drop Mix', 
    'EQ Mix', 
    'Loop',
    'Stems',
    'Crossfade',
    'Wordplay',
    'Overlap',
    'Other'
  ],
  modifiers: {
    'Drop Mix': ['Fast', 'PreDropVocalsA', 'PreDropVocalsB', 'Alt Chorus', 'Buildup Mix', 'No Sync', 'CutVocalsA','CutVocalsB'],
    'EQ Mix': ['Meet BPM', 'Fast Bass Swap', 'Lower Hi\'s', 'LoopOutro', 'LoopIntro'],
    'Loop': ['TightenA', 'LoopB'],
    'Stems': ['VocalsA', 'VocalsB','Slow Fade In'],
    'Crossfade': ['Slow', 'Smart Fader', 'Sync', 'No Sync'],
    'Wordplay': ['Crossfade'],
    'Overlap': ['HPF out', 'No Sync', 'Cut Bass B'],
    'Other': ['Play', 'No Sync'],
  },
};
export function createAccessors() {
  const props = Object.keys(sharedState);
  for (let prop of props) {
    // Check if setter already exists
    if (!Object.getOwnPropertyDescriptor(window, prop)) {
      Object.defineProperty(window, prop, {
        set: (value) => {
          sharedState[prop] = value; 
        },
        get: () => sharedState[prop]
      });
    }
  }
}