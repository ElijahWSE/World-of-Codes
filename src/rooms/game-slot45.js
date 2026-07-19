export const game = {
  gameName: 'FIFA World Cup 2026 1v1 Football',

  onGameLoad(scene) {
    // Assets are generated procedurally using Phaser Graphics to avoid loading external assets
  },

  onGameCreate(scene) {
    scene.gameData = {
      p1Score: 0,
      p2Score: 0,
      matchTimer: 90,
      gameState: 'PLAYING',
      gameMode: '1PLAYER', // '1PLAYER' (VS CPU) or '2PLAYER' (local WASD vs Arrow keys)
      kickTimerP1: 0,
      kickTimerP2: 0,
      team1: { primary: 0x1e3a8a, secondary: 0xffffff, accent: 0xef4444, name: "USA" },
      team2: { primary: 0x047857, secondary: 0xdc2626, accent: 0xffffff, name: "MEX" }
    };

    scene.gameData.platforms = scene.physics.add.staticGroup();

    const groundGfx = scene.add.graphics();
    groundGfx.fillStyle(0x064e3b, 1);
    groundGfx.fillRect(0, 550, 800, 40); // Turf spans from Y: 550 to Y: 590
    
    // Alternating green turf stripes
    groundGfx.fillStyle(0x047857, 0.3);
    for (let x = 0; x < 800; x += 100) {
      groundGfx.fillRect(x, 550, 50, 40);
    }
    
    // Midfield paint markings
    groundGfx.lineStyle(4, 0xffffff, 0.4);
    groundGfx.beginPath();
    groundGfx.moveTo(0, 550);
    groundGfx.lineTo(800, 550);
    groundGfx.moveTo(400, 250);
    groundGfx.lineTo(400, 550);
    groundGfx.strokePath();

    // Draw center spot arc safely using Phaser lineTo approximations for arc
    groundGfx.beginPath();
    for (let angle = 180; angle <= 360; angle += 10) {
      const rad = Phaser.Math.DegToRad(angle);
      const ax = 400 + Math.cos(rad) * 80;
      const ay = 550 + Math.sin(rad) * 80;
      if (angle === 180) groundGfx.moveTo(ax, ay);
      else groundGfx.lineTo(ax, ay);
    }
    groundGfx.strokePath();

    // Physically bind the turf ground
    const groundPhys = scene.add.rectangle(400, 570, 800, 40, 0x000000, 0);
    scene.physics.add.existing(groundPhys, true);
    scene.gameData.platforms.add(groundPhys);

    const stadiumGfx = scene.add.graphics();
    stadiumGfx.fillStyle(0x0b1329, 1);
    stadiumGfx.fillRect(0, 65, 800, 485); // Back walls

    // Crowd visualizer dots
    for (let i = 0; i < 150; i++) {
      const cx = Phaser.Math.Between(10, 790);
      const cy = Phaser.Math.Between(120, 280);
      const cColor = Phaser.Math.RND.pick([0xff0055, 0x00ffff, 0xfacc15, 0xffffff]);
      stadiumGfx.fillStyle(cColor, 0.2);
      stadiumGfx.fillCircle(cx, cy, Phaser.Math.Between(1, 3));
    }

    // Jumbotron frame
    stadiumGfx.fillStyle(0x020617, 0.85);
    stadiumGfx.fillRect(250, 80, 300, 55);
    stadiumGfx.lineStyle(2, 0x10b981, 1);
    stadiumGfx.strokeRect(250, 80, 300, 55);

    scene.gameData.scoreText = scene.add.text(400, 100, "USA 0 - 0 MEX", {
      fontFamily: 'monospace',
      fontSize: '20px',
      fontWeight: 'bold',
      fill: '#10b981',
    }).setOrigin(0.5);

    scene.gameData.timerText = scene.add.text(400, 122, "TIME: 90", {
      fontFamily: 'monospace',
      fontSize: '12px',
      fill: '#ffffff',
    }).setOrigin(0.5);

    // Interactive button using clickable Phaser text objects
    scene.gameData.modeButton = scene.add.text(400, 155, "⚽ MODE: 1 PLAYER (VS CPU) ⚽", {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontWeight: 'bold',
      fill: '#facc15',
      backgroundColor: '#1e293b',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setInteractive();

    scene.gameData.modeButton.on('pointerdown', () => {
      if (scene.gameData.gameState !== 'PLAYING') return;
      if (scene.gameData.gameMode === '1PLAYER') {
        scene.gameData.gameMode = '2PLAYER';
        scene.gameData.modeButton.setText("👥 MODE: 2 PLAYER (LOCAL) 👥");
        scene.gameData.modeButton.setStyle({ fill: '#38bdf8' });
        scene.gameData.p2Label.setText("P2");
      } else {
        scene.gameData.gameMode = '1PLAYER';
        scene.gameData.modeButton.setText("⚽ MODE: 1 PLAYER (VS CPU) ⚽");
        scene.gameData.modeButton.setStyle({ fill: '#facc15' });
        scene.gameData.p2Label.setText("CPU");
      }
    });

    const leftGoalPost = scene.add.graphics();
    leftGoalPost.lineStyle(4, 0xffffff, 1);
    leftGoalPost.beginPath();
    leftGoalPost.moveTo(10, 550);
    leftGoalPost.lineTo(10, 420);
    leftGoalPost.lineTo(75, 420);
    leftGoalPost.lineTo(75, 550);
    leftGoalPost.strokePath();

    leftGoalPost.lineStyle(1.5, 0xffffff, 0.2);
    for (let ny = 420; ny <= 550; ny += 15) {
      leftGoalPost.beginPath();
      leftGoalPost.moveTo(10, ny);
      leftGoalPost.lineTo(75, ny);
      leftGoalPost.strokePath();
    }
    for (let nx = 10; nx <= 75; nx += 15) {
      leftGoalPost.beginPath();
      leftGoalPost.moveTo(nx, 420);
      leftGoalPost.lineTo(nx, 550);
      leftGoalPost.strokePath();
    }

    const leftCrossbar = scene.add.rectangle(42, 420, 65, 10, 0x000000, 0);
    scene.physics.add.existing(leftCrossbar, true);
    scene.gameData.platforms.add(leftCrossbar);

    const rightGoalPost = scene.add.graphics();
    rightGoalPost.lineStyle(4, 0xffffff, 1);
    rightGoalPost.beginPath();
    rightGoalPost.moveTo(790, 550);
    rightGoalPost.lineTo(790, 420);
    rightGoalPost.lineTo(725, 420);
    rightGoalPost.lineTo(725, 550);
    rightGoalPost.strokePath();

    rightGoalPost.lineStyle(1.5, 0xffffff, 0.2);
    for (let ny = 420; ny <= 550; ny += 15) {
      rightGoalPost.beginPath();
      rightGoalPost.moveTo(790, ny);
      rightGoalPost.lineTo(725, ny);
      rightGoalPost.strokePath();
    }
    for (let nx = 725; nx <= 790; nx += 15) {
      rightGoalPost.beginPath();
      rightGoalPost.moveTo(nx, 420);
      rightGoalPost.lineTo(nx, 550);
      rightGoalPost.strokePath();
    }

    const rightCrossbar = scene.add.rectangle(758, 420, 65, 10, 0x000000, 0);
    scene.physics.add.existing(rightCrossbar, true);
    scene.gameData.platforms.add(rightCrossbar);

    scene.gameData.p1 = scene.add.container(200, 480);
    const p1Gfx = scene.add.graphics();
    p1Gfx.fillStyle(0xffdbac, 1);
    p1Gfx.fillCircle(0, -35, 14);
    p1Gfx.fillStyle(0x000000, 1);
    p1Gfx.fillRect(-12, -49, 24, 11);
    p1Gfx.fillRect(4, -38, 4, 4);
    p1Gfx.fillStyle(scene.gameData.team1.accent, 1);
    p1Gfx.fillRect(-14, -40, 28, 4);

    p1Gfx.fillStyle(scene.gameData.team1.primary, 1);
    p1Gfx.fillRect(-12, -21, 24, 25);
    p1Gfx.fillStyle(scene.gameData.team1.secondary, 1);
    p1Gfx.fillRect(-4, -21, 8, 25);

    const p1Foot = scene.add.rectangle(12, 12, 16, 8, 0xfacc15);
    p1Foot.setOrigin(0.5);
    scene.gameData.p1Foot = p1Foot;
    scene.gameData.p1.add(p1Gfx);
    scene.gameData.p1.add(p1Foot);

    const p1Label = scene.add.text(0, -60, "P1", {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontWeight: 'bold',
      fill: '#38bdf8',
      backgroundColor: '#020617',
      padding: { x: 4, y: 1 }
    }).setOrigin(0.5);
    scene.gameData.p1.add(p1Label);

    scene.physics.add.existing(scene.gameData.p1);
    scene.gameData.p1.body.setCollideWorldBounds(true);
    scene.gameData.p1.body.setGravityY(1000);
    scene.gameData.p1.body.setSize(30, 65);
    scene.gameData.p1.body.setOffset(-15, -45);

    scene.gameData.p2 = scene.add.container(600, 480);
    const p2Gfx = scene.add.graphics();
    p2Gfx.fillStyle(0xffdbac, 1);
    p2Gfx.fillCircle(0, -35, 14);
    p2Gfx.fillStyle(0x451a03, 1);
    p2Gfx.fillRect(-12, -49, 24, 11);
    p2Gfx.fillStyle(0x000000, 1);
    p2Gfx.fillRect(-8, -38, 4, 4);
    p2Gfx.fillStyle(scene.gameData.team2.accent, 1);
    p2Gfx.fillRect(-14, -40, 28, 4);

    p2Gfx.fillStyle(scene.gameData.team2.primary, 1);
    p2Gfx.fillRect(-12, -21, 24, 25);
    p2Gfx.fillStyle(scene.gameData.team2.secondary, 1);
    p2Gfx.fillRect(-4, -21, 8, 25);

    const p2Foot = scene.add.rectangle(-12, 12, 16, 8, 0xfacc15);
    p2Foot.setOrigin(0.5);
    scene.gameData.p2Foot = p2Foot;
    scene.gameData.p2.add(p2Gfx);
    scene.gameData.p2.add(p2Foot);

    scene.gameData.p2Label = scene.add.text(0, -60, "CPU", {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontWeight: 'bold',
      fill: '#f87171',
      backgroundColor: '#020617',
      padding: { x: 4, y: 1 }
    }).setOrigin(0.5);
    scene.gameData.p2.add(scene.gameData.p2Label);

    scene.physics.add.existing(scene.gameData.p2);
    scene.gameData.p2.body.setCollideWorldBounds(true);
    scene.gameData.p2.body.setGravityY(1000);
    scene.gameData.p2.body.setSize(30, 65);
    scene.gameData.p2.body.setOffset(-15, -45);

    scene.gameData.ball = scene.add.container(400, 200);
    const ballShadow = scene.add.graphics();
    ballShadow.fillStyle(0x000000, 0.4);
    ballShadow.fillEllipse(0, 13, 20, 6);
    scene.gameData.ball.add(ballShadow);

    const ballBodyGfx = scene.add.graphics();
    ballBodyGfx.fillStyle(0xffffff, 1);
    ballBodyGfx.fillCircle(0, 0, 14);
    ballBodyGfx.fillStyle(0x111827, 1);
    ballBodyGfx.fillCircle(0, 0, 4);
    ballBodyGfx.fillTriangle(-10, -5, -6, -10, -11, -11);
    ballBodyGfx.fillTriangle(10, 5, 6, 10, 11, 11);
    ballBodyGfx.fillTriangle(-8, 8, -4, 10, -10, 11);
    ballBodyGfx.fillTriangle(8, -8, 4, -10, 10, -11);
    scene.gameData.ball.add(ballBodyGfx);
    scene.gameData.ballBodyGfx = ballBodyGfx;

    scene.physics.add.existing(scene.gameData.ball);
    scene.gameData.ball.body.setCollideWorldBounds(true);
    scene.gameData.ball.body.setCircle(14, -14, -14);
    scene.gameData.ball.body.setGravityY(750);
    scene.gameData.ball.body.setBounce(0.85, 0.85);
    scene.gameData.ball.body.setDamping(true);
    scene.gameData.ball.body.setDrag(0.99, 0.99);

    scene.physics.add.collider(scene.gameData.p1, scene.gameData.platforms);
    scene.physics.add.collider(scene.gameData.p2, scene.gameData.platforms);
    scene.physics.add.collider(scene.gameData.ball, scene.gameData.platforms);
    scene.physics.add.collider(scene.gameData.p1, scene.gameData.p2);

    scene.physics.add.collider(scene.gameData.p1, scene.gameData.ball, (player, ball) => {
      const forceX = (ball.x - player.x) * 6.5;
      ball.body.setVelocityX(forceX);
    });

    scene.physics.add.collider(scene.gameData.p2, scene.gameData.ball, (player, ball) => {
      const forceX = (ball.x - player.x) * 6.5;
      ball.body.setVelocityX(forceX);
    });

    // Score Banner overlay text
    scene.gameData.goalBanner = scene.add.text(400, 300, "", {
      fontFamily: 'monospace',
      fontSize: '38px',
      fontWeight: 'bold',
      fill: '#facc15',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setAlpha(0);

    scene.gameData.keys = scene.input.keyboard.addKeys({
      p1Left: Phaser.Input.Keyboard.KeyCodes.A,
      p1Right: Phaser.Input.Keyboard.KeyCodes.D,
      p1Jump: Phaser.Input.Keyboard.KeyCodes.W,
      p1Kick: Phaser.Input.Keyboard.KeyCodes.SPACE,
      
      p2Left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      p2Right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      p2Jump: Phaser.Input.Keyboard.KeyCodes.UP,
      p2Kick: Phaser.Input.Keyboard.KeyCodes.P,
      p2KickAlt: Phaser.Input.Keyboard.KeyCodes.ENTER
    });

    // Timer Interval Trigger
    scene.time.addEvent({
      delay: 1000,
      callback: () => {
        if (scene.gameData && scene.gameData.gameState === 'PLAYING') {
          scene.gameData.matchTimer--;
          scene.gameData.timerText.setText("TIME: " + scene.gameData.matchTimer);
          if (scene.gameData.matchTimer <= 0) {
            this.engineTriggerEnd(scene);
          }
        }
      },
      loop: true
    });
  },

  onGameUpdate(scene) {
    if (!scene.gameData) return;

    if (scene.gameData.ball && scene.gameData.ballBodyGfx) {
      const vx = scene.gameData.ball.body.velocity.x;
      scene.gameData.ballBodyGfx.rotation += vx * 0.0015;
    }

    if (scene.gameData.gameState !== 'PLAYING') return;

    const keys = scene.gameData.keys;
    const p1 = scene.gameData.p1;
    const p2 = scene.gameData.p2;
    const ball = scene.gameData.ball;

    if (keys.p1Left.isDown) {
      p1.body.setVelocityX(-185);
    } else if (keys.p1Right.isDown) {
      p1.body.setVelocityX(185);
    } else {
      p1.body.setVelocityX(0);
    }

    // Safety ground check bounds for reliable jumping mechanics
    const p1OnGround = p1.body.blocked.down || p1.body.touching.down || p1.y >= 480;
    if (keys.p1Jump.isDown && p1OnGround) {
      p1.body.setVelocityY(-430);
    }

    // Kick mechanics for Player 1
    if (Phaser.Input.Keyboard.JustDown(keys.p1Kick) && scene.time.now > scene.gameData.kickTimerP1) {
      scene.gameData.kickTimerP1 = scene.time.now + 400;
      scene.tweens.add({
        targets: scene.gameData.p1Foot,
        angle: 70,
        duration: 100,
        yoyo: true
      });

      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, ball.x, ball.y);
      if (dist < 65) {
        ball.body.setVelocity(500, -390);
        this.engineKickingSparks(scene, ball.x, ball.y, 0x00ffff);
      }
    }

    if (scene.gameData.gameMode === "2PLAYER") {
      if (keys.p2Left.isDown) {
        p2.body.setVelocityX(-185);
      } else if (keys.p2Right.isDown) {
        p2.body.setVelocityX(185);
      } else {
        p2.body.setVelocityX(0);
      }

      const p2OnGround = p2.body.blocked.down || p2.body.touching.down || p2.y >= 480;
      if (keys.p2Jump.isDown && p2OnGround) {
        p2.body.setVelocityY(-430);
      }

      if ((Phaser.Input.Keyboard.JustDown(keys.p2Kick) || Phaser.Input.Keyboard.JustDown(keys.p2KickAlt)) && scene.time.now > scene.gameData.kickTimerP2) {
        scene.gameData.kickTimerP2 = scene.time.now + 400;
        scene.tweens.add({
          targets: scene.gameData.p2Foot,
          angle: -70,
          duration: 100,
          yoyo: true
        });

        const dist = Phaser.Math.Distance.Between(p2.x, p2.y, ball.x, ball.y);
        if (dist < 65) {
          ball.body.setVelocity(-500, -390);
          this.engineKickingSparks(scene, ball.x, ball.y, 0xff3b30);
        }
      }
    } else {
      // Intelligent CPU Auto-tracking loop
      const diffX = ball.x - p2.x;
      if (Math.abs(diffX) > 20) {
        p2.body.setVelocityX(diffX < 0 ? -145 : 145);
      } else {
        p2.body.setVelocityX(0);
      }

      const p2OnGround = p2.body.blocked.down || p2.body.touching.down || p2.y >= 480;
      if (ball.y < p2.y - 50 && Math.abs(diffX) < 100 && p2OnGround && Math.random() < 0.05) {
        p2.body.setVelocityY(-390);
      }

      const distToBall = Phaser.Math.Distance.Between(p2.x, p2.y, ball.x, ball.y);
      if (distToBall < 65 && scene.time.now > scene.gameData.kickTimerP2) {
        scene.gameData.kickTimerP2 = scene.time.now + 600;
        scene.tweens.add({
          targets: scene.gameData.p2Foot,
          angle: -70,
          duration: 100,
          yoyo: true
        });
        ball.body.setVelocity(-430, -310);
        this.engineKickingSparks(scene, ball.x, ball.y, 0xff9500);
      }
    }

    // Goal Left -> Team 2 scores
    if (ball.x <= 75 && ball.y > 420 && ball.y < 550) {
      this.engineProcessGoal(scene, 2);
    }

    // Goal Right -> Team 1 scores
    if (ball.x >= 725 && ball.y > 420 && ball.y < 550) {
      this.engineProcessGoal(scene, 1);
    }
  },

  onGameExit(scene) {
    scene.gameData = null;
  },

  engineKickingSparks(scene, x, y, color) {
    for (let i = 0; i < 8; i++) {
      const spark = scene.add.circle(x, y, Phaser.Math.Between(3, 6), color);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      scene.physics.add.existing(spark);
      spark.body.setVelocity(Phaser.Math.Between(-200, 200), Phaser.Math.Between(-200, 200));
      scene.tweens.add({
        targets: spark,
        alpha: 0,
        scale: 0.1,
        duration: 500,
        onComplete: () => spark.destroy()
      });
    }
  },

  engineProcessGoal(scene, scoringPlayer) {
    scene.gameData.gameState = 'GOAL_SCORED';
    scene.gameData.ball.body.setVelocity(0, 0);
    scene.gameData.ball.body.setGravityY(0);

    if (scoringPlayer === 1) {
      scene.gameData.p1Score++;
      scene.gameData.goalBanner.setText("GOAL PLAYER 1! ⚽");
      scene.gameData.goalBanner.setFill("#38bdf8");
    } else {
      scene.gameData.p2Score++;
      const isCpu = scene.gameData.gameMode === '1PLAYER';
      scene.gameData.goalBanner.setText(isCpu ? "GOAL CPU! ⚽" : "GOAL PLAYER 2! ⚽");
      scene.gameData.goalBanner.setFill("#f87171");
    }

    scene.gameData.scoreText.setText(`USA ${scene.gameData.p1Score} - ${scene.gameData.p2Score} MEX`);

    scene.tweens.add({
      targets: scene.gameData.goalBanner,
      alpha: 1,
      scale: { from: 0.4, to: 1.2 },
      duration: 600,
      yoyo: true,
      hold: 1200,
      onComplete: () => {
        if (!scene.gameData) return;
        if (scene.gameData.p1Score >= 5 || scene.gameData.p2Score >= 5) {
          this.engineTriggerEnd(scene);
        } else {
          scene.gameData.gameState = 'PLAYING';
          scene.gameData.p1.setPosition(200, 480);
          scene.gameData.p1.body.setVelocity(0, 0);
          scene.gameData.p2.setPosition(600, 480);
          scene.gameData.p2.body.setVelocity(0, 0);
          scene.gameData.ball.setPosition(400, 200);
          scene.gameData.ball.body.setVelocity(0, 0);
          scene.gameData.ball.body.setGravityY(750);
        }
      }
    });
  },

  engineTriggerEnd(scene) {
    scene.gameData.gameState = 'OVER';
    scene.gameData.ball.body.setVelocity(0, 0);

    let winnerText = "MATCH TIED!";
    if (scene.gameData.p1Score > scene.gameData.p2Score) {
      winnerText = "P1 CHAMPION! 🏆";
    } else if (scene.gameData.p2Score > scene.gameData.p1Score) {
      const isCpu = scene.gameData.gameMode === '1PLAYER';
      winnerText = isCpu ? "CPU CHAMPION! 🤖" : "P2 CHAMPION! 🏆";
    }

    scene.gameData.goalBanner.setText(winnerText);
    scene.gameData.goalBanner.setFill("#fbbf24");

    scene.tweens.add({
      targets: scene.gameData.goalBanner,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 1000,
      onComplete: () => {
        scene.exitGame();
      }
    });
  }
};