import { createCanvas, loadImage } from 'canvas';

export async function generateGameImage(gameData: GameState): Promise<string> {
  if (!gameData.grid || gameData.grid.length === 0) {
    console.error('Grid is not initialized correctly');
    return 'test.jpg';
  } else {
    const canvas = createCanvas(420, 420); // Added 20 pixels for padding
    const ctx = canvas.getContext('2d');

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const card = gameData.grid[row][col];
        const imagePath = `../public/${card.id + 1}.jpg`;
        const image = await loadImage(imagePath);
        ctx.drawImage(image, col * 105 + 5, row * 105 + 5, 100, 100);
      }
    }

    const base64Image = canvas.toDataURL();
    return base64Image;
  }
}
