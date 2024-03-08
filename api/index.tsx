import { Button, Frog, TextInput } from 'frog'
// import { neynar } from 'frog/hubs'
import { handle } from 'frog/vercel'
import { getGameState, upsertGameState, initializeGameState } from '../utils/database';

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

const url = process.env.VERCEL_URL || 'http://localhost:5173'

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
})

const maxGalleryImages = 8;



app.frame('/', async (c) =>  {
  var errorMessage = null;
  var statusMessage = null;
  const { buttonValue, inputText, status, frameData, cycle } = c;
  if(frameData){
    /* GAME IS BEING PLAYED! */
    let gameState;
    const { fid } = (frameData) ? frameData : null;
    const cardToFlip = (inputText) ? inputText : null;
    const actionValue = buttonValue;
    let gameStateString = await getGameState(fid);
    if (!gameStateString || buttonValue === 'newgame') {
      gameStateString = initializeGameState();
      await upsertGameState(fid, gameStateString);
    }
    gameState = JSON.parse(gameStateString);
    // Handle Modes First
    if(actionValue == 'gallery' || actionValue == 'forward-gallery' || actionValue == 'back-gallery') {
      gameState.mode = 'GALLERY';
      if (cycle === 'main'){
        if(actionValue == 'forward-gallery'){
          gameState.galleryImage++;
          if(gameState.galleryImage > maxGalleryImages){
            gameState.galleryImage = 1;
          }
        }
        if(actionValue == 'back-gallery'){
          gameState.galleryImage--;
          if(gameState.galleryImage <= 1){
            gameState.galleryImage = maxGalleryImages;
          }
        }
      }
    }
    if(actionValue == 'game' || buttonValue === 'newgame' || actionValue == 'flip') {
      gameState.mode = 'GAME';
      if(gameState.matchesFound >= 8){
        gameState.mode = 'WINNER';
      }
      if (cycle === 'main'){
        // check if they submitted a card.
        if(!cardToFlip){
          gameState.errorMessage = '';
          gameState.statusMessage = '';
        }
        var validCard = handleCardInput(cardToFlip);
        if(!cardToFlip && actionValue == 'flip'){
          errorMessage = 'You did not specify a card to flip.';
        }
        if(cardToFlip && actionValue == 'flip'){
          if(validCard && actionValue == 'flip'){
            const standardizedCardToFlip = handleCardInput(cardToFlip);
            const { row, col } = convertPositionToIndices(standardizedCardToFlip);
            if (standardizedCardToFlip) {
              const result = processFlipAndCheckMatch(gameState, row, col);
              gameState = result;
            } else {
              gameState.errorMessage = 'You did not specify a valid card to flip. Try "A1", "B3", etc please.';
            }
          } else {
            gameState.errorMessage = 'You did not specify a valid card to flip. Try "A1", "B3", etc please.';
          }
        }
      }
    }
    console.log('gameState', gameState);
    await upsertGameState(fid, JSON.stringify(gameState));
    if(gameState.errorMessage && gameState.mode == 'GAME'){
      return c.res(errorFrame(gameState));
    } else {
      if(gameState.mode === 'WINNER') {
        return c.res(winnerFrame());
      } else if(gameState.mode === 'GAME') {
        return c.res(gameFrame(actionValue, cardToFlip, gameState, status));
      } else {
        return c.res(galleryFrame(gameState));
      }
    }
  } else {
    return c.res(introFrame());
  }
})

function gameFrame(actionValue, cardToFlip, gameState, status) {
  const positionLabels = ['A', 'B', 'C', 'D'].flatMap((letter, row) =>
    [1, 2, 3, 4].map((number, col) => `${letter}${number}`)
  );

  const grid = gameState.grid.map((row, rowIndex) =>
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {row.map((card, colIndex) => (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          margin: '6px',
        }}>
          <img
            src={`${url}/${card.flipped ? card.id : '0'}.jpg`}
            alt={`Card ${positionLabels[rowIndex * 4 + colIndex]}`}
            style={{
              width: '100px',
              height: '100px',
              border: `2px solid ${card.flipped ? '#C8A2C8' : 'darkgrey'}`,
            }}
          />
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'white' }}>
            {positionLabels[rowIndex * 4 + colIndex]}
          </div>
        </div>
      ))}
    </div>
  );

  // Define status message based on errorMessage or default messages
  let displayMessage = gameState.statusMessage;
  if (gameState.errorMessage) {
    displayMessage = gameState.errorMessage;
  }

  return {
    imageAspectRatio: "1:1",
    image: (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: status === 'response' ? 'linear-gradient(to right, #432889, #17101F)' : 'black',
        backgroundSize: '100% 100%',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: '90%', marginTop: '20px' }}>
          {grid}
        </div>
        <div style={{ marginTop: '16px', fontSize: '16px', color: 'white', textAlign: 'center' }}>
          {displayMessage}
        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Flip a Card (1A, 2B, etc)..." />,
      <Button value="flip">Flip</Button>,
      <Button value="gallery">Go to Gallery</Button>,
      status === 'response' && <Button.Reset>New Game</Button.Reset>,
    ],
  };
}

function galleryFrame(gameState){
  return {
    imageAspectRatio: "1:1",
    image: (
      <div
        style={{
          alignItems: 'center',
          background: 'linear-gradient(to right, #432889, #17101F)',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <img
          src={`${url}/${gameState.galleryImage}.jpg`}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    ),
    intents: [
      <Button value="back-gallery">Prev</Button>,
      <Button value="forward-gallery">Next</Button>,
      <Button value="game">Go to Game</Button>,
    ],
  };
}

function errorFrame(gameState){
  return {
    imageAspectRatio: "1:1",
    image: (
      <div
        style={{
          alignItems: 'center',
          background: 'darkred',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'wrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: '36px',
            fontStyle: 'normal',
            display: 'flex',
            justifyContent: 'center', // Center the content
            alignItems: 'center', // Center the content vertically
            letterSpacing: '-0.025em',
            textAlign: 'center',
            padding: '25%',
            width: '100%',
            wordBreak: 'break-word', // Break words to prevent overflow
          }}
        >
          {gameState.errorMessage}
        </div>
      </div>
    ),
    intents: [
      <Button value="game">Whoops, Let me try again!</Button>,
    ],
  };
}

function introFrame(){
  return {
    imageAspectRatio: "1:1",
    image: (
      <div
        style={{
          alignItems: 'center',
          background: 'black',
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: '12px',
            fontStyle: 'normal',
            display: 'flex',
            justifyContent: 'center', // Center the content
            alignItems: 'center', // Center the content vertically
            letterSpacing: '0.22rem',
            textAlign: 'center',
            padding: '25%',
            paddingBottom: '14px',
            textTransform: 'uppercase',
            width: '100%',
            wordBreak: 'break-word', // Break words to prevent overflow
          }}
        >
          {'Mumbot Presents:'}
        </div>
        <div
          style={{
            color: 'white',
            fontSize: '86px',
            lineHeight: '1',
            fontStyle: 'normal',
            display: 'flex',
            justifyContent: 'center', // Center the content
            alignItems: 'center', // Center the content vertically
            letterSpacing: '-0.025em',
            textAlign: 'center',
            padding: '25%',
            paddingTop: '0px',
            width: '100%',
            wordBreak: 'break-word', // Break words to prevent overflow
          }}
        >
          {'MEMORIES'}
        </div>
      </div>
    ),
    intents: [
      <Button value="start">Lets Go!</Button>,
    ],
  };
}

function winnerFrame(){
  return {
    imageAspectRatio: "1:1",
    image: (
      <div
        style={{
          alignItems: 'center',
          background: 'black',
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {'You Won!!'}
        </div>
      </div>
    ),
    intents: [
      <Button value="newgame">Play Again!</Button>,
      <Button value="gallery">Gallery</Button>,
      <Button value="mumbot">More From Mumbot</Button>,
    ],
  };
}

function cardToPosition(cardIdentifier) {
  if (typeof cardIdentifier !== 'string') {
    console.error("cardIdentifier must be a string");
    return; // Or handle the error as appropriate
  }
  cardIdentifier = cardIdentifier.toUpperCase();
  const colChar = cardIdentifier.length === 3 ? cardIdentifier.substring(1, 3) : cardIdentifier[1];
  const col = parseInt(colChar, 10) - 1;
  const row = cardIdentifier.charCodeAt(0) - 'A'.charCodeAt(0);
  return { row, col };
}

function convertPositionToIndices(cardPosition) {
  const rowChar = cardPosition.charAt(0).toUpperCase();
  const colNum = parseInt(cardPosition.charAt(1), 10);
  const rowIndex = rowChar.charCodeAt(0) - 'A'.charCodeAt(0);
  const colIndex = colNum - 1;
  return { row: rowIndex, col: colIndex };
}

// Function to flip a card and check for matches
function processFlipAndCheckMatch(gameState, row, col ) {
  if (row < 0 || row >= gameState.grid.length || col < 0 || col >= gameState.grid[0].length) {
    console.error("Invalid card position");
    gameState.errorMessage = 'Invalid card position';
    return gameState;
  }
  if (gameState.grid[row][col].matched) {
    gameState.statusMessage = 'This card is already matched and cannot be flipped.';
    return gameState;
  }
  gameState.grid[row][col].flipped = !gameState.grid[row][col].flipped;
  const flippedCards = [];
  gameState.grid.forEach((row, rowIndex) => {
    row.forEach((card, colIndex) => {
      if (card.flipped && !card.matched) {
        flippedCards.push({ card, row: rowIndex, col: colIndex });
      }
    });
  });
  if (flippedCards.length === 1) {
    gameState.firstFlipped = `${String.fromCharCode(65 + row)}${col + 1}`;
    gameState.statusMessage = `You flipped ${gameState.firstFlipped}, find its match!`;
  } else if (flippedCards.length === 2) {
    if (flippedCards[0].card.id === flippedCards[1].card.id) {
      flippedCards.forEach(({ row, col }) => gameState.grid[row][col].matched = true);
      gameState.statusMessage = "Cards MATCHED! Find more!";
      gameState.matchesFound++;
      if(gameState.matchesFound >= 8){
        gameState.mode = 'WINNER';
      }
    } else {
      flippedCards.forEach(({ row, col }) => gameState.grid[row][col].flipped = false);
      gameState.statusMessage = "Cards didn't match. Try again.";
    }
    gameState.firstFlipped = null;
  }
  return gameState;
}


function isValidCardInput(input: string): boolean {
  const pattern = /^(?:[A-D][1-4]|[1-4][A-D])$/i;
  return pattern.test(input);
}

function convertToStandardForm(input: string): string {
  if (/^[A-D][1-4]$/i.test(input)) {
    return input.toUpperCase();
  }
  if (/^[1-4][A-D]$/i.test(input)) {
    return `${input[1].toUpperCase()}${input[0]}`;
  }
  return null;
}

function handleCardInput(input: string) {
  if (!isValidCardInput(input)) {
    return null;
  }
  const standardizedInput = convertToStandardForm(input);
  return standardizedInput;
}

export const GET = handle(app)
export const POST = handle(app)
