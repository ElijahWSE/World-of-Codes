export const game = {
  gameName: 'Canteen Lunch Clash',

  onGameLoad(scene) {
    // No external image/audio assets needed; uses procedural graphics and emojis.
  },

  onGameCreate(scene) {
    // Initialize all state inside scene.gameData
    scene.gameData = {
      board: [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
      ],
      currentPlayer: '🍎', 
      player1Symbol: '🍎',
      player2Symbol: '🍩',
      gameOver: false,
      winner: null,
      winLine: null,
      turns: 0,
      cells: [],     
      sprites: [],   
      trayGraphics: null,
      winStrike: null,
      promptBox: null,
      promptText: null,
      promptCountdown: null,
      headerText: null,
      turnText: null,
      exitButton: null,
      exitText: null
    };

    const gd = scene.gameData;

    // Helper: Check win state
    const checkWin = () => {
      const b = gd.board;
      const lines = [
        [[0,0], [0,1], [0,2]],
        [[1,0], [1,1], [1,2]],
        [[2,0], [2,1], [2,2]],
        [[0,0], [1,0], [2,0]],
        [[0,1], [1,1], [2,1]],
        [[0,2], [1,2], [2,2]],
        [[0,0], [1,1], [2,2]],
        [[0,2], [1,1], [2,0]]
      ];

      for (const line of lines) {
        const [p1, p2, p3] = line;
        if (b[p1[0]][p1[1]] !== '' &&
            b[p1[0]][p1[1]] === b[p2[0]][p2[1]] &&
            b[p1[0]][p1[1]] === b[p3[0]][p3[1]]) {
          gd.winLine = line;
          return true;
        }
      }
      return false;
    };

    // Helper: Handle game termination cleanup and exit delay
    const triggerCleanupPopup = (statusMsg) => {
      gd.promptBox = scene.add.rectangle(400, 390, 360, 140, 0x1a1a1a, 0.92);
      gd.promptBox.setStrokeStyle(4, 0xffeb3b);

      gd.promptText = scene.add.text(400, 365, statusMsg, {
        fontSize: '18px',
        fontFamily: 'Impact, Arial Black, sans-serif',
        fill: '#ffffff'
      }).setOrigin(0.5);

      let timeLeft = 3;
      gd.promptCountdown = scene.add.text(400, 410, `Clearing tray in ${timeLeft}s...`, {
        fontSize: '14px',
        fontFamily: 'Courier New, monospace',
        fill: '#ffd54f'
      }).setOrigin(0.5);

      scene.time.addEvent({
        delay: 1000,
        callback: () => {
          timeLeft--;
          if (gd.promptCountdown) {
            if (timeLeft > 0) {
              gd.promptCountdown.setText(`Clearing tray in ${timeLeft}s...`);
            } else {
              scene.exitGame();
            }
          }
        },
        repeat: 2
      });
    };

    // Helper: Handle Win Display
    const handleWin = (centers) => {
      const winnerName = gd.winner === gd.player1Symbol ? "Apple 🍎" : "Donut 🍩";
      gd.turnText.setText(`${winnerName} Claims Victory!`);

      const startCell = centers[gd.winLine[0][0]][gd.winLine[0][1]];
      const endCell = centers[gd.winLine[2][0]][gd.winLine[2][1]];

      const lineGraphics = scene.add.graphics();
      lineGraphics.lineStyle(12, 0xffeb3b, 0.9);
      lineGraphics.lineBetween(startCell.x, startCell.y, endCell.x, endCell.y);
      gd.winStrike = lineGraphics;

      scene.tweens.add({
        targets: lineGraphics,
        alpha: 0.3,
        duration: 200,
        yoyo: true,
        repeat: 5
      });

      triggerCleanupPopup(`${winnerName} wins the food fight!`);
    };

    // Helper: Handle Draw Display
    const handleDraw = () => {
      gd.turnText.setText("Food Fight! It's a Tie! 🤝");
      triggerCleanupPopup("No lunch trays cleared!");
    };

    // Draw cafeteria tabletop backdrop
    const tray = scene.add.graphics();
    tray.fillStyle(0x8d5b4c, 1);
    tray.fillRect(0, 65, 800, 525);

    // Decorative table shadows
    tray.fillStyle(0x764b3e, 1);
    tray.fillRect(0, 65, 800, 10);

    // Vibrant plastic school lunch tray
    tray.fillStyle(0x1e88e5, 1); 
    tray.fillRoundedRect(180, 105, 440, 450, 24);
    
    tray.lineStyle(6, 0x1565c0, 1);
    tray.strokeRoundedRect(180, 105, 440, 450, 24);

    // Top Header Tray Compartment
    tray.fillStyle(0x1565c0, 1);
    tray.fillRoundedRect(200, 125, 400, 55, 12);

    // Header text inside compartment
    gd.headerText = scene.add.text(400, 153, "CANTEEN LUNCH CLASH!", {
      fontSize: '22px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      fill: '#ffca28',
      stroke: '#0d47a1',
      strokeThickness: 5
    }).setOrigin(0.5);

    // Current Turn Subheader
    gd.turnText = scene.add.text(400, 210, "Apple's Turn 🍎", {
      fontSize: '20px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      fill: '#ffffff',
      stroke: '#1565c0',
      strokeThickness: 4
    }).setOrigin(0.5);

    // White tray dividers (grid layout)
    tray.lineStyle(8, 0xffffff, 0.95);
    tray.lineBetween(230, 345, 570, 345);
    tray.lineBetween(230, 455, 570, 455);
    tray.lineBetween(340, 235, 340, 565);
    tray.lineBetween(460, 235, 460, 565);

    gd.trayGraphics = tray;

    // Grid center positions relative to the tray boundaries
    const cellCenters = [
      [{x: 285, y: 290}, {x: 400, y: 290}, {x: 515, y: 290}],
      [{x: 285, y: 400}, {x: 400, y: 400}, {x: 515, y: 400}],
      [{x: 285, y: 510}, {x: 400, y: 510}, {x: 515, y: 510}]
    ];

    // Build the grid of interaction cells
    for (let r = 0; r < 3; r++) {
      gd.cells[r] = [];
      for (let c = 0; c < 3; c++) {
        const pos = cellCenters[r][c];
        const zone = scene.add.zone(pos.x, pos.y, 110, 100).setInteractive();
        
        zone.setData('row', r);
        zone.setData('col', c);
        
        zone.on('pointerdown', () => {
          if (gd.gameOver) return;
          const row = zone.getData('row');
          const col = zone.getData('col');
          
          if (gd.board[row][col] === '') {
            gd.board[row][col] = gd.currentPlayer;
            gd.turns++;
            
            // Pop food icon with bouncing scale animation
            const emoji = scene.add.text(pos.x, pos.y, gd.currentPlayer, {
              fontSize: '52px'
            }).setOrigin(0.5);
            
            emoji.setScale(0);
            scene.tweens.add({
              targets: emoji,
              scale: 1,
              angle: Phaser.Math.Between(-15, 15),
              duration: 250,
              ease: 'Back.easeOut'
            });
            
            gd.sprites.push(emoji);

            if (checkWin()) {
              gd.gameOver = true;
              gd.winner = gd.currentPlayer;
              handleWin(cellCenters);
            } else if (gd.turns === 9) {
              gd.gameOver = true;
              handleDraw();
            } else {
              gd.currentPlayer = gd.currentPlayer === gd.player1Symbol ? gd.player2Symbol : gd.player1Symbol;
              const name = gd.currentPlayer === gd.player1Symbol ? "Apple 🍎" : "Donut 🍩";
              gd.turnText.setText(`${name}'s Turn!`);
            }
          }
        });

        // Hover effect for cell selection indicator
        zone.on('pointerover', () => {
          if (gd.gameOver || gd.board[r][c] !== '') return;
          const hoverRect = scene.add.rectangle(pos.x, pos.y, 100, 90, 0xffffff, 0.15);
          zone.setData('hoverBg', hoverRect);
        });

        zone.on('pointerout', () => {
          const bg = zone.getData('hoverBg');
          if (bg) {
            bg.destroy();
            zone.setData('hoverBg', null);
          }
        });

        gd.cells[r][c] = zone;
      }
    }

    // Interactive exit/trash button
    const exitBtn = scene.add.rectangle(710, 540, 140, 42, 0xd32f2f).setInteractive();
    exitBtn.setStrokeStyle(2, 0xffffff);
    
    const exitTxt = scene.add.text(710, 540, "🚪 Dump Tray", {
      fontSize: '13px',
      fontFamily: 'Impact, Arial Black, sans-serif',
      fill: '#ffffff'
    }).setOrigin(0.5);

    exitBtn.on('pointerdown', () => {
      scene.exitGame();
    });

    exitBtn.on('pointerover', () => exitBtn.setFillStyle(0xb71c1c));
    exitBtn.on('pointerout', () => exitBtn.setFillStyle(0xd32f2f));

    gd.exitButton = exitBtn;
    gd.exitText = exitTxt;
  },

  onGameUpdate(scene) {
    // Game loop runs continuously. Unused here as logic is fully event-driven.
  },

  onGameExit(scene) {
    if (scene.gameData) {
      scene.gameData = null; // Purge all references to clean memory
    }
  }
};