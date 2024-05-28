const fs = require('fs').promises; 
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const xml2js = require('xml2js');
const path = require('path');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const songMap = {};

// Initialize the output XML file if it doesn't exist or is corrupt
async function initializeTransitionsDB() {
  try {
    const xmlString = await fs.readFile('transitionsDB.xml', 'utf8');
    if (!xmlString || !xmlString.trim()) {
      throw new Error('XML file is empty or corrupt');
    }
  } catch (error) {
    const initialXML = { Songs: {} };
    const xml = builder.buildObject(initialXML);
    await fs.writeFile('transitionsDB.xml', xml, 'utf8');
  }
}

async function inputDatabase() {
  try {
    const xml1 = await fs.readFile('C:\\Users\\v-arasouli\\AppData\\Local\\VirtualDJ\\database.xml', 'utf8');
    const xml2 = await fs.readFile('D:\\VirtualDJ\\database.xml', 'utf8');
    
    const parsed1 = await parser.parseStringPromise(xml1);
    const parsed2 = await parser.parseStringPromise(xml2);
    const songs1 = parsed1.VirtualDJ_Database.Song;
    const songs2 = parsed2.VirtualDJ_Database.Song;
    const mergedSongs = [...songs1, ...songs2];

    // Build lookup map
    for (const song of mergedSongs) {
      songMap[song.$.FilePath] = song;
    }
  } catch (error) {
    console.error('Error reading XML files:', error);
  }
}

(async () => {
  await inputDatabase();
  await initializeTransitionsDB();
})();

app.get('/get_filepath/:deck', async (req, res) => {
  try {
    const deck = req.params.deck;
    const response = await axios.get(`http://localhost/query?script=deck ${deck} get_filepath`);
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send(error);
  }
});

app.get('/get_master', async (req, res) => {
  try {
    const response = await axios.get(`http://localhost/query?script=get_activedeck`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: "Could not retrieve cue points.\n"+error });
  }
});

app.post('/get_cue_points', (req, res) => {
  const track = req.body.track;
//  console.log("track:", track);
  try {
    const points = getCuePoints(track);
    res.json(points);
  } catch (error) {
    console.error("Error retrieving cue points:", error);
    res.status(500).json({ error: "Could not retrieve cue points." });
  }
});

app.post('/save_transition', async (req, res) => {
  try {
    console.log(req.body);

    const { 
      track1Path, track2Path, track1Cue, track2Cue, track1Cue2, track2Cue2, 
      track2Cue1Pos, track2Cue2Pos, track1Cue1Pos, track1Cue2Pos, 
      transition, direction, modifiers, comment, rating 
    } = req.body;    
    if (direction !== 'left_to_right' && direction !== 'right_to_left') {
      throw new Error('Invalid direction');
    }
    let xmlString = await fs.readFile('transitionsDB.xml', 'utf8');
    let result = await parser.parseStringPromise(xmlString);
    //console.log('Parsed XML to JS:', JSON.stringify(result, null, 2));
    if (!result || !result.Songs) {
      result = { Songs: { Song: [] } };
    }
    const songs = result.Songs.Song || [];
    const keyTrack = direction === 'left_to_right' ? track1Path : track2Path;
    let songNode = songs.find(song => song.keyTrack && song.keyTrack[0] === keyTrack);

    const transitionObj = cleanObject({
      track2: direction === 'left_to_right' ? track2Path : track1Path,
      track1Cue: direction === 'left_to_right' ? track1Cue : track2Cue,
      track2Cue: direction === 'left_to_right' ? track2Cue : track1Cue,
      track1Cue2: direction === 'left_to_right' ? track1Cue2 : track2Cue2,
      track2Cue2: direction === 'left_to_right' ? track2Cue2 : track1Cue2,
      track1Cue1Pos: direction === 'left_to_right' ? track1Cue1Pos : track2Cue1Pos,
      track1Cue2Pos: direction === 'left_to_right' ? track1Cue2Pos : track2Cue2Pos,
      track2Cue1Pos: direction === 'left_to_right' ? track2Cue1Pos : track1Cue1Pos,
      track2Cue2Pos: direction === 'left_to_right' ? track2Cue2Pos : track1Cue2Pos,
      transition,
      comment,
      modifiers,
      rating
    });

    if (!songNode) {
      // If the song node doesn't exist, create a new one
      songNode = { keyTrack: keyTrack, transitions: [transitionObj] };
      songs.push(songNode);
    } else {
      // If the song node exists, just add a new transition
      if (!Array.isArray(songNode.transitions)) {
        songNode.transitions = [];
      }
      songNode.transitions.push(transitionObj);
    }
    if (!result.Songs.Song) {
      result.Songs.Song = songs;
    }

    // Rebuild XML and save
    //console.log("Final result before writing to XML:", JSON.stringify(result, null, 2)); // too much output
    const updatedXML = builder.buildObject(result);
    await fs.writeFile('transitionsDB.xml', updatedXML, 'utf8');
    res.send('Transition saved');
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/get_transitions', async (req, res) => {
  try {
    const keyTrackParam = req.body.keyTrack;
    if (!keyTrackParam) {
      return res.status(400).send('keyTrack is required in the request body.');
    }
    let xmlString = await fs.readFile('transitionsDB.xml', 'utf8');
    let result = await parser.parseStringPromise(xmlString);

    if (!result || !result.Songs || !result.Songs.Song) {
      return res.status(404).send('No transitions found for the given song.');
    }

    const songNode = result.Songs.Song.find(song => song.keyTrack && song.keyTrack[0] === keyTrackParam);

    if (!songNode || !songNode.transitions) {
      return res.status(404).send('No transitions found for the given song.');
    }

    const enrichedTransitions = songNode.transitions.map(transition => {
      const track2Song = songMap[transition.track2];
      
      let actualBpm = null;
      let genre = null;
      
      if (track2Song) {
        if (track2Song.Scan && track2Song.Scan[0].$.Bpm) {
          actualBpm = 60 / parseFloat(track2Song.Scan[0].$.Bpm);
        }
        
        if (track2Song.Tags && track2Song.Tags[0].$.Genre) {
          genre = track2Song.Tags[0].$.Genre;
        }
      }
      return {
        ...transition,
        track2Bpm: actualBpm,
        track2Genre: genre
      };
    });

    console.log("RETURN TRANSITIONS")
    console.log(enrichedTransitions)
    res.json(enrichedTransitions);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/send_to_vdj', async (req, res) => {
  try {
    // TODO: get track from request
    const response 
    = await axios.post(`http://localhost/execute`,
     `search "${req.body.track}"`,
      {headers: {'Content-Type': 'text/plain'}});
    res.json(response.data);
    console.log(response.data);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: "Could not retrieve cue points.\n"+error });
  }
});

app.get('/refresh_database', async (req, res) => {
  try {
    await inputDatabase();  // Re-read and parse the XML databases
    res.send('Database refreshed');
  } catch (error) {
    console.error('Error refreshing database:', error);
    res.status(500).send('Internal Server Error');
  }
});

function getCuePoints(songFilePath) {
  const songNode = getSong(songFilePath);
  if(!songNode){
    console.log("songNode is null in getCuePoints");
    return;
  }

  const points = (songNode.Poi || []).filter(poi => poi.$ && poi.$.Num);
  const cuePoints = new Array(8).fill(null);

  for (const point of points) {
    const num = parseInt(point.$.Num, 10);
    if (num && num <= 8) {
      const cueType = point.$.Type || "blank";
      const cueName = point.$.Name || `${cueType} ${num}`;
      
      cuePoints[num - 1] = {
        name: cueName,
        number: num,
        pos: point.$.Pos || null,
      };
    }
  }
  return cuePoints;
}

// Function to get song by path  
function getSong(filePath) {
  return songMap[filePath];
}

// Removes any properties that had null values 
function cleanObject(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

const findPathsFromNode = (node, allSongs, visited, currentPath, allPaths) => {
  const nextTracks = allSongs.filter(song => node.transitions[0].track2.includes(song.keyTrack[0]));
  
  if (nextTracks.length === 0) {
    // Handle the case where a song exists as a transition but not as a song node
    for (let nextTrackKey of node.transitions[0].track2) {
      if (!visited.has(nextTrackKey)) {
        const dummyNode = { keyTrack: [nextTrackKey], transitions: [{}] };
        currentPath.push(dummyNode);
        
        if (currentPath.length >= 2) {
          allPaths.push([...currentPath]);
        }

        currentPath.pop();
      }
    }
  }
  
  for (let nextTrack of nextTracks) {
    if (!visited.has(nextTrack.keyTrack[0])) {
      visited.add(nextTrack.keyTrack[0]);
      currentPath.push(nextTrack);

      if (currentPath.length >= 2) {
        allPaths.push([...currentPath]);
      }

      findPathsFromNode(nextTrack, allSongs, visited, currentPath, allPaths);

      visited.delete(nextTrack.keyTrack[0]);
      currentPath.pop();
    }
  }
};

app.post('/find_paths', async (req, res) => {
  try {
    let xmlString = await fs.readFile('transitionsDB.xml', 'utf8');
    let result = await parser.parseStringPromise(xmlString);

    const allSongs = result.Songs.Song;
    if (!allSongs) {
      return res.status(404).send('No songs found in the transitions DB.');
    }

    const allPaths = [];
    const visited = new Set();

    // find all paths
    for (let startNode of allSongs) {
      visited.add(startNode.keyTrack[0]);
      findPathsFromNode(startNode, allSongs, visited, [startNode], allPaths);
      visited.delete(startNode.keyTrack[0]);
    }

    const formatPathForOutput = path => path.map(getTitleFromPath).join(' 🡆 ');

    let sortedPaths = allPaths.sort((a, b) => b.length - a.length);

    // Step 2: Turn all paths into strings.
    let sortedPathsStrings = sortedPaths.map(formatPathForOutput);

    // Step 3: Create a hashmap to store the string representation of each subpath.
    let subpathHashMap = new Set();

    // Step 4: Iterate through sortedPathsStrings to eliminate subpaths.
    let uniquePathsStrings = [];
    for (let i = 0; i < sortedPathsStrings.length; i++) {
      const pathString = sortedPathsStrings[i];
      if (!subpathHashMap.has(pathString)) {
        uniquePathsStrings.push(pathString);

        // Step 5: Update the hashmap with the subpaths of the current path.
        const parts = pathString.split(" 🡆 ");
        for (let start = 0; start < parts.length; start++) {
          for (let end = start + 1; end <= parts.length; end++) {
            const subpathString = parts.slice(start, end).join(" 🡆 ");
            subpathHashMap.add(subpathString);
          }
        }
      }
    }
    
    const allPathsOutputData = uniquePathsStrings.map(pathString => {
      const formattedString = formatForDisplay(pathString);
      return `Path Size: ${pathString.split(' 🡆 ').length}\n${formattedString}`;
    }).join('\n\n');

    await fs.writeFile('allPaths.txt', allPathsOutputData, 'utf8');

    res.send('Paths successfully written to allPaths.txt');
  } catch (error) {
    console.error('Error finding paths:', error);
    res.status(500).send('Server error while finding paths.');
  }
});

const getTitleFromPath = (pathItem) => {
  const fileName = pathItem.keyTrack[0].split('\\').pop();
  return fileName.substring(0, fileName.lastIndexOf('.'));
};

function formatForDisplay(pathString) {
  const songs = pathString.split(' 🡆 ');
  let formattedString = "";
  for (let i = 0; i < songs.length; i++) {
    if (i % 4 === 0 && i !== 0) {
      formattedString += "\n";
    }
    formattedString += songs[i];
    if (i !== songs.length - 1) {
      formattedString += " 🡆 ";
    }
  }
  return formattedString;
}

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000/');
});




