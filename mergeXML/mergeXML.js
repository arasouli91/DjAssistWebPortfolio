const fs = require("fs").promises;
const xml2js = require("xml2js");
const path = require("path");
const builder = new xml2js.Builder({
  rootName: "VirtualDJ_Database",
  xmldec: { version: '1.0', encoding: 'UTF-8' }
});
const parser = new xml2js.Parser({ explicitArray: false });

const delimiters = ["/", ".", ";", ","];
const songMap = {};
const modifiedSongs = [];
// all songs from current database that are not modified
const unmodifiedSongs = [];

async function processDatabases() {
  try {
    let approvedGenres;
    try {
      const configData = await fs.readFile("mergeXML/config.txt", "utf8");
      approvedGenres = configData.split(/\r?\n/); // Split by new line to handle both Unix and Windows line endings
    } catch (error) {
      console.error("Error reading config.txt:", error);
      process.exit(1); // Exit if there is an error reading the file
    }

    // we will merge changes into whatever songs exist in currentDB
    const currentDb = await fs.readFile("mergeXML/currentDb.xml", "utf8");
    const oldDb = await fs.readFile("mergeXML/oldDb.xml", "utf8");

    const currentDbParsed = await parser.parseStringPromise(currentDb);
    const oldDbParsed = await parser.parseStringPromise(oldDb);
    const newSongs = currentDbParsed.VirtualDJ_Database.Song;
    const oldSongs = oldDbParsed.VirtualDJ_Database.Song;

    // Build lookup map
    for (const song of newSongs) {
      songMap[song.$.FilePath] = song;
    }

    // Iterate through new songs
    for (const newSong of newSongs) {
      let modified = false; // Flag to track if the current song has been modified
      const oldSong = oldSongs.find(oSong => oSong.$.FilePath === newSong.$.FilePath); // Find the corresponding old song

      // Check if there is a corresponding old song and compare properties
      if (oldSong) {
        console.log("oldSong: " + oldSong.$.FilePath)
          // Split genres by delimiters and compare
          if (oldSong.Tags.genre && newSong.Tags.genre) {
              const oldGenres = splitGenres(oldSong.Tags.genre, delimiters);
              const newGenres = splitGenres(newSong.Tags.genre, delimiters);
              const oldFirstGenre = oldGenres[0];
              const newFirstGenre = newGenres[0];

              // If the first genre we see in the new song is not approved
              if (!approvedGenres.includes(newFirstGenre)) {
                  // If the first genre in the old song is approved, use it
                  if (approvedGenres.includes(oldFirstGenre)) {
                    console.log("using old genre")
                    console.log("old genre: " + oldFirstGenre)
                      newSong.Tags.genre = oldSong.Tags.genre;
                      modified = true; // Mark as modified if genre changed
                  }
              }
          }

          // Merge comments if applicable
          console.log("newSong comment: " + newSong.Tags.comment)
          console.log("oldSong comment: " + oldSong.Tags?.comment)
          if (!newSong.Tags.comment && oldSong.Tags?.comment?.startsWith("#")) {
              console.log("merging comments:" + oldSong.Tags.comment)
              newSong.Tags.comment = oldSong.Tags.comment;
              modified = true; // Mark as modified if comments merged
          }

          // Check PlayCount in both old and new DB
          const playCountExists = newSong.Infos.PlayCount !== undefined || oldSong.Infos.PlayCount !== undefined;
          // Remove cue points if there is no PlayCount in both old and new DB
          if (!playCountExists) {
            console.log("removing cue points")
            console.log("oldSong Playcount: " + oldSong.Infos.PlayCount)
            console.log("newSong Playcount: " + newSong.Infos.PlayCount)
              newSong.Poi = newSong.Poi.filter(poi => !isActiveCue(poi));
              modified = true; // Mark as modified if cue points removed
          }
      }

      // Activate cue points if there are no active cues
      if (activateCuePoints(newSong)) {
        console.log("activating cue points")
          modified = true; // Mark as modified if cue points activated
      }

      // Categorize the song based on whether it was modified
      if (modified) {
          modifiedSongs.push(newSong); // Add to the list of modified songs
      } else {
          unmodifiedSongs.push(newSong); // Add to the list of unmodified songs
      }
    }

    // Filter missing files
    const output = [];
    for (const filePath of Object.keys(songMap)) {
      try {
        await fs.access(filePath);
        output.push(songMap[filePath]);
      } catch (error) {
        // File does not exist or cannot be accessed
      }
    }

    let fullXml;
    try {
      fullXml = builder.buildObject({
        $: { Version: "2023" },
        Song: output 
      });
    } catch (e) {
      console.error('Error building XML:', e);
      return; // exit if there is an error building the XML
    }


    // Write the full XML to file
    await fs.writeFile("mergeXML/database.xml", fullXml);

    // Build the XML for only modified songs
    const modifiedXml = builder.buildObject({
      $: { Version: "2023" },
      Song: modifiedSongs
    });

    // Write the modified songs XML to file
    await fs.writeFile("mergeXML/modifiedSongs.xml", modifiedXml);

  } catch (error) {
    console.error(error);
  }
}


function activateCuePoints(song) {
  const activeCues = song.Poi.filter(isActiveCue);
  let breakCount = 1;
  
  // If there are no active cues, activate up to 8 break/endbreak cues in sequence
  if (activeCues.length === 0) {
    for (const poi of song.Poi) {
      if (poi.$.Type === 'remix' && (poi.$.Name.startsWith('Break') || poi.$.Name.startsWith('End Break'))) {
        poi.$.Num = breakCount.toString(); // Assign a number to make it an active cue
        breakCount++;
        if (breakCount > 8) break; // We only activate up to 8 cues
      }
    }
  }
  return breakCount > 1;
}

function splitGenres(genreString, delimiters) {
  const delimiterRegex = new RegExp(delimiters.join('|'), 'g');
  return genreString.split(delimiterRegex);
}

function isActiveCue(poi) {
  return poi.$ && 'Num' in poi.$;
}

// Call the async function to process the databases
processDatabases();
