import {
    _decorator,
    AudioClip,
    AudioSource,
    Color,
    Component,
    director,
    EventMouse,
    EventTouch,
    input,
    Input,
    Label,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    sys,
    UITransform,
    Vec3,
    view,
} from 'cc';
import { AudioManager, AudioSettings } from './AudioManager';

const { ccclass, property } = _decorator;
const BACKGROUND_WIDTH = 640;
const BACKGROUND_HEIGHT = 1480;

type WoodJumpState = 'ready' | 'playing' | 'gameOver';

interface WoodRow {
    root: Node;
    left: Node;
    right: Node;
    coins: Node[];
    scored: boolean;
    leftBreaking: boolean;
    rightBreaking: boolean;
    leftGone: boolean;
    rightGone: boolean;
}

@ccclass('WoodJumpManager')
export class WoodJumpManager extends Component {
    @property(SpriteFrame)
    public bgFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public hpFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public woodBodyFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public woodCapFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public gameOverPanelFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonNormalFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public buttonPressedFrame: SpriteFrame | null = null;

    @property([SpriteFrame])
    public birdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public redBirdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public blueBirdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public purpleBirdFrames: SpriteFrame[] = [];

    @property([SpriteFrame])
    public coinFrames: SpriteFrame[] = [];

    private readonly bestScoreKey = 'woodjump_best_score';
    private readonly coinScoreKey = 'flappy_coin_score';
    private readonly ownedBirdsKey = 'flappy_owned_birds';
    private readonly selectedBirdKey = 'flappy_selected_bird';

    private state: WoodJumpState = 'ready';
    private background: Node | null = null;
    private world: Node | null = null;
    private rowLayer: Node | null = null;
    private bird: Node | null = null;
    private hudLayer: Node | null = null;
    private hpTextLabel: Label | null = null;
    private scoreLabel: Label | null = null;
    private bestLabel: Label | null = null;
    private coinScoreLabel: Label | null = null;
    private gameOverPanel: Node | null = null;
    private restartButton: Node | null = null;
    private menuButton: Node | null = null;
    private reviveButton: Node | null = null;
    private audioSource: AudioSource | null = null;
    private hitClip: AudioClip | null = null;
    private jumpClip: AudioClip | null = null;
    private coinClip: AudioClip | null = null;
    private pressedGameOverButton: Node | null = null;
    private hpNodes: Node[] = [];
    private rows: WoodRow[] = [];
    private activeBirdFrames: SpriteFrame[] = [];

    private screenWidth = 0;
    private screenHeight = 0;
    private score = 0;
    private bestScore = 0;
    private coinScore = 0;
    private lives = 3;
    private birdVelocityX = 0;
    private birdVelocityY = 0;
    private birdAnimTimer = 0;
    private birdFrameIndex = 0;
    private invincibleTimer = 0;
    private hitSoundTimer = 0;
    private coinAnimTimer = 0;
    private nextRowY = 0;
    private lastJumpDirection: -1 | 1 = 1;
    private reviveAvailable = true;

    private birdScale = 1.8;
    private birdWidth = 86.4;
    private birdHeight = 86.4;
    private maxLives = 3;
    private gravity = -1780;
    private jumpVelocity = 1020;
    private horizontalJumpVelocity = 430;
    private horizontalDamping = 0.985;
    private bottomBounceVelocity = 760;
    private scrollThresholdRatio = 0;
    private smoothScrollSpeed = 420;
    private topSafeMargin = 120;
    private rowSpacing = 580;
    private barScale = 2;
    private barHeight = 104;
    private bodyWidth = 128;
    private capWidth = 160;
    private capVisibleWidth = 80;
    private capJoinOverlap = 0;
    private gapBirdWidthMin = 2.5;
    private gapBirdWidthMax = 3.5;
    private gapCenterRange = 70;
    private invincibleDuration = 1;
    private breakSpeed = 900;
    private hitSoundCooldown = 0.08;
    private hitSoundVolume = 0.85;
    private jumpSoundVolume = 0.55;
    private coinSoundVolume = 0.65;
    private coinSize = 64;
    private coinGapRatio = 0.2;
    private coinCountMin = 3;
    private coinCountMax = 4;
    private coinFrameWidth = 64;
    private coinFrameHeight = 64;
    private coinAnimDuration = 0.5;
    private birdFrameInterval = 0.12;

    protected onLoad(): void {
        this.refreshScreenSize();
        this.loadSavedScores();
        AudioManager.ensure();
        this.audioSource = getOrAddComponent(this.node, AudioSource);
        this.loadEffectSounds();
        this.createScene();
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onTouchStart, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onTouchStart, this);
    }

    protected update(deltaTime: number): void {
        this.refreshScreenSize();
        this.hitSoundTimer = Math.max(0, this.hitSoundTimer - deltaTime);
        this.updateBirdAnimation(deltaTime);
        this.updateInvincible(deltaTime);

        if (this.state !== 'playing') {
            return;
        }

        this.birdVelocityY += this.gravity * deltaTime;
        this.moveBird(deltaTime);
        this.applyVerticalScroll(deltaTime);
        this.updateRows(deltaTime);
        this.updateCoinAnimation(deltaTime);
        this.checkCollisions();
        this.scorePassedRows();
        this.spawnRowsUntilTop();
    }

    private createScene(): void {
        this.activeBirdFrames = this.getSelectedBirdFrames();

        this.background = this.createSpriteNode('WoodJumpBackground', this.bgFrame, this.node, BACKGROUND_WIDTH, BACKGROUND_HEIGHT);
        this.background.setSiblingIndex(0);

        this.world = getOrCreateChild(this.node, 'WoodJumpWorld');
        this.world.layer = this.node.layer;
        this.world.setPosition(0, 0, 0);
        getOrAddComponent(this.world, UITransform).setContentSize(this.screenWidth, this.screenHeight);

        this.rowLayer = getOrCreateChild(this.world, 'WoodRowLayer');
        this.rowLayer.layer = this.world.layer;
        this.rowLayer.setPosition(0, 0, 0);
        getOrAddComponent(this.rowLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);

        this.bird = this.createSpriteNode('WoodJumpBird', this.activeBirdFrames[0] || this.birdFrames[0] || null, this.world, 48, 48);
        this.bird.setScale(this.birdScale, this.birdScale, 1);

        this.hudLayer = getOrCreateChild(this.node, 'WoodJumpHud');
        this.hudLayer.layer = this.node.layer;
        this.hudLayer.setPosition(0, 0, 0);
        getOrAddComponent(this.hudLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);

        this.createHpHud();
        this.scoreLabel = this.createLabel('WoodJumpScoreLabel', '0', 64, new Vec3(0, 0, 0), this.hudLayer);
        this.bestLabel = this.createLabel('WoodJumpBestLabel', `Best ${this.bestScore}`, 34, new Vec3(0, 0, 0), this.hudLayer);
        this.coinScoreLabel = this.createLabel('WoodJumpCoinScoreLabel', `Coin ${this.coinScore}`, 34, new Vec3(0, 0, 0), this.hudLayer);
        this.createGameOverPanel();
        this.layoutScene();
        this.resetGame();
    }

    private createHpHud(): void {
        if (!this.hudLayer) {
            return;
        }

        this.hpNodes.length = 0;
        for (let i = 0; i < this.maxLives; i++) {
            const hp = this.createSpriteNode(`WoodJumpHp_${i}`, this.hpFrame, this.hudLayer, 256, 256);
            hp.setScale(0.22, 0.22, 1);
            this.hpNodes.push(hp);
        }

        this.hpTextLabel = this.createLabel('WoodJumpHpTextLabel', `HP: ${this.lives}`, 28, new Vec3(0, 0, 0), this.hudLayer);
        this.hpTextLabel.color = new Color(255, 40, 40, 255);
    }

    private createGameOverPanel(): void {
        if (!this.hudLayer) {
            return;
        }

        this.gameOverPanel = this.createSpriteNode('WoodJumpGameOverPanel', this.gameOverPanelFrame, this.hudLayer, 480, 340);
        this.gameOverPanel.active = false;

        this.createLabel('WoodJumpGameOverTitle', '游戏结束', 42, new Vec3(0, 95, 0), this.gameOverPanel);
        this.restartButton = this.createGameOverButton('WoodJumpRestartButton', '重新开始', () => this.restartGame());
        this.menuButton = this.createGameOverButton('WoodJumpMenuButton', '回到主菜单', () => this.backToMainMenu());
        this.reviveButton = this.createGameOverButton('WoodJumpReviveButton', '立即复活', () => this.reviveGame());
        this.layoutGameOverPanel();
    }

    private createGameOverButton(name: string, text: string, onClick: () => void): Node {
        const button = this.createSpriteNode(name, this.buttonNormalFrame, this.gameOverPanel, 142, 64);
        const label = this.createLabel(`${name}Label`, text, 30, new Vec3(0, 2, 0), button);
        label.color = new Color(96, 53, 18, 255);
        this.bindGameOverButton(button, onClick);
        return button;
    }

    private resetGame(): void {
        this.state = 'ready';
        this.score = 0;
        this.lives = this.maxLives;
        this.birdVelocityX = 0;
        this.birdVelocityY = 0;
        this.lastJumpDirection = 1;
        this.invincibleTimer = 0;
        this.coinAnimTimer = 0;
        this.nextRowY = 0;
        this.reviveAvailable = true;

        for (const row of this.rows) {
            row.root.destroy();
        }
        this.rows.length = 0;

        if (this.bird) {
            this.bird.setPosition(0, -this.screenHeight * 0.26, 0);
            this.bird.angle = 0;
            this.setBirdAlpha(255);
        }

        this.nextRowY = -this.screenHeight * 0.26 + this.rowSpacing;
        this.spawnRowsUntilTop();
        this.updateHud();
        this.hideGameOverPanel();
    }

    private restartGame(): void {
        this.resetGame();
    }

    private backToMainMenu(): void {
        director.loadScene('Start');
    }

    private reviveGame(): void {
        if (this.state !== 'gameOver' || !this.reviveAvailable) {
            return;
        }

        this.reviveAvailable = false;
        this.state = 'playing';
        this.lives = this.maxLives;
        this.invincibleTimer = this.invincibleDuration;
        this.birdVelocityX = 0;
        this.birdVelocityY = this.bottomBounceVelocity;
        this.lastJumpDirection = 1;

        if (this.bird) {
            this.bird.setPosition(0, -this.screenHeight * 0.18, 0);
            this.bird.angle = 0;
        }

        this.setBirdAlpha(90);
        this.updateHud();
        this.hideGameOverPanel();
    }

    private onTouchStart(event: EventTouch | EventMouse): void {
        if (this.state === 'gameOver') {
            return;
        }

        if (this.state === 'ready') {
            this.state = 'playing';
        }

        this.jumpBird(this.getJumpDirection(event));
    }

    private getJumpDirection(event: EventTouch | EventMouse): -1 | 1 {
        const location = event.getUILocation();
        return location.x < this.screenWidth / 2 ? -1 : 1;
    }

    private jumpBird(direction: -1 | 1): void {
        this.lastJumpDirection = direction;
        this.birdVelocityX = direction * this.horizontalJumpVelocity;
        this.birdVelocityY = this.jumpVelocity;
        this.playJumpSound();
    }

    private moveBird(deltaTime: number): void {
        if (!this.bird) {
            return;
        }

        const minX = -this.screenWidth / 2 + this.birdWidth * 0.45;
        const maxX = this.screenWidth / 2 - this.birdWidth * 0.45;
        let nextX = this.bird.position.x + this.birdVelocityX * deltaTime;
        const nextY = this.bird.position.y + this.birdVelocityY * deltaTime;

        if (nextX < minX) {
            nextX = minX;
            this.birdVelocityX = Math.max(0, this.birdVelocityX);
        } else if (nextX > maxX) {
            nextX = maxX;
            this.birdVelocityX = Math.min(0, this.birdVelocityX);
        }

        this.bird.setPosition(nextX, nextY, 0);
        this.birdVelocityX *= Math.pow(this.horizontalDamping, deltaTime * 60);
        this.bird.setScale(this.lastJumpDirection * this.birdScale, this.birdScale, 1);
        this.bird.angle = Math.max(-35, Math.min(25, this.birdVelocityY / 28)) + this.lastJumpDirection * 7;
    }

    private applyVerticalScroll(deltaTime: number): void {
        if (!this.bird) {
            return;
        }

        const thresholdY = this.screenHeight * this.scrollThresholdRatio;
        if (this.bird.position.y <= thresholdY) {
            return;
        }

        const overflow = this.bird.position.y - thresholdY;
        let scroll = Math.min(overflow, this.smoothScrollSpeed * deltaTime);
        const maxBirdY = this.screenHeight / 2 - this.topSafeMargin;
        const nextBirdY = this.bird.position.y - scroll;
        if (nextBirdY > maxBirdY) {
            scroll += nextBirdY - maxBirdY;
        }

        this.bird.setPosition(this.bird.position.x, this.bird.position.y - scroll, 0);
        for (const row of this.rows) {
            row.root.setPosition(row.root.position.x, row.root.position.y - scroll, 0);
        }
        this.nextRowY -= scroll;
    }

    private spawnRowsUntilTop(): void {
        if (!this.rowLayer) {
            return;
        }

        const topLimit = this.screenHeight / 2 + this.rowSpacing * 1.5;
        while (this.nextRowY < topLimit) {
            this.spawnRow(this.nextRowY);
            this.nextRowY += this.rowSpacing;
        }
    }

    private spawnRow(y: number): void {
        if (!this.rowLayer) {
            return;
        }

        const gapScale = this.gapBirdWidthMin + Math.random() * (this.gapBirdWidthMax - this.gapBirdWidthMin);
        const gapWidth = this.birdWidth * gapScale;
        const maxGapCenter = Math.max(0, Math.min(this.gapCenterRange, this.screenWidth / 2 - gapWidth / 2 - 40));
        const gapCenterX = (Math.random() * 2 - 1) * maxGapCenter;
        const gapLeftX = gapCenterX - gapWidth / 2;
        const gapRightX = gapCenterX + gapWidth / 2;
        const outside = this.screenWidth / 2 + this.bodyWidth;

        const root = new Node('WoodRow');
        root.setParent(this.rowLayer);
        root.layer = this.rowLayer.layer;
        root.setPosition(0, y, 0);

        const left = this.createWoodBar('LeftWoodBar', root, -outside, gapLeftX, 'left');
        const right = this.createWoodBar('RightWoodBar', root, gapRightX, outside, 'right');
        const coins = this.createCoins(root, gapCenterX, gapWidth);

        this.rows.push({
            root,
            left,
            right,
            coins,
            scored: false,
            leftBreaking: false,
            rightBreaking: false,
            leftGone: false,
            rightGone: false,
        });
    }

    private createWoodBar(name: string, parent: Node, startX: number, endX: number, side: 'left' | 'right'): Node {
        const width = Math.max(12, Math.abs(endX - startX));
        const centerX = (startX + endX) / 2;
        const bar = new Node(name);
        bar.setParent(parent);
        bar.layer = parent.layer;
        bar.setPosition(centerX, 0, 0);
        getOrAddComponent(bar, UITransform).setContentSize(width, this.barHeight);

        if (!this.woodBodyFrame || !this.woodCapFrame) {
            return bar;
        }

        const bodyStartX = side === 'left' ? -width / 2 : -width / 2 + this.capVisibleWidth - this.capJoinOverlap;
        const bodyEndX = side === 'left' ? width / 2 - this.capVisibleWidth + this.capJoinOverlap : width / 2;
        const bodyFillWidth = Math.max(0, bodyEndX - bodyStartX);
        if (bodyFillWidth > 0) {
            const body = this.createSpriteNode(`${name}Body`, this.woodBodyFrame, bar, bodyFillWidth / this.barScale, 52);
            const bodySprite = body.getComponent(Sprite);
            if (bodySprite) {
                bodySprite.type = Sprite.Type.TILED;
            }
            body.setScale(this.barScale, this.barScale, 1);
            body.setPosition((bodyStartX + bodyEndX) / 2, 0, 0);
        }

        const cap = this.createSpriteNode(`${name}Cap`, this.woodCapFrame, bar, 80, 52);
        const capX = side === 'left' ? width / 2 - this.capWidth / 2 : -width / 2 + this.capWidth / 2;
        cap.setScale(side === 'left' ? this.barScale : -this.barScale, this.barScale, 1);
        cap.setPosition(capX, 0, 0);

        return bar;
    }

    private createCoins(parent: Node, gapCenterX: number, gapWidth: number): Node[] {
        const initialFrame = this.coinFrames[0];
        if (!initialFrame || this.coinSize <= 0) {
            return [];
        }

        const coinSpacing = this.coinSize * this.coinGapRatio;
        const defaultStep = this.coinSize + coinSpacing;
        const sidePadding = this.coinSize * 0.05;
        let coinCount = this.coinCountMin + Math.floor(Math.random() * (this.coinCountMax - this.coinCountMin + 1));
        const preferredWidth = coinCount * this.coinSize + Math.max(0, coinCount - 1) * coinSpacing + sidePadding * 2;
        if (coinCount > this.coinCountMin && preferredWidth > gapWidth) {
            coinCount = this.coinCountMin;
        }
        const centerSpanLimit = Math.max(0, gapWidth - this.coinSize - sidePadding * 2);
        const step = Math.min(defaultStep, coinCount > 1 ? centerSpanLimit / (coinCount - 1) : 0);
        const totalWidth = step * Math.max(0, coinCount - 1);
        const firstX = gapCenterX - totalWidth / 2;
        const coins: Node[] = [];

        for (let i = 0; i < coinCount; i++) {
            const coin = this.createSpriteNode(`WoodJumpCoin_${i}`, initialFrame, parent, this.coinFrameWidth, this.coinFrameHeight);
            coin.setScale(1, 1, 1);
            coin.setPosition(firstX + i * step, 0, 0);
            coins.push(coin);
        }

        return coins;
    }

    private updateCoinAnimation(deltaTime: number): void {
        if (this.coinFrames.length === 0 || this.coinAnimDuration <= 0) {
            return;
        }

        this.coinAnimTimer = (this.coinAnimTimer + deltaTime) % this.coinAnimDuration;
        const frameIndex = Math.floor((this.coinAnimTimer / this.coinAnimDuration) * this.coinFrames.length) % this.coinFrames.length;
        const frame = this.coinFrames[frameIndex];
        if (!frame) {
            return;
        }

        for (const row of this.rows) {
            for (const coin of row.coins) {
                if (!coin.active) {
                    continue;
                }

                const sprite = coin.getComponent(Sprite);
                if (sprite) {
                    sprite.spriteFrame = frame;
                }
            }
        }
    }

    private updateRows(deltaTime: number): void {
        const leftGoneX = -this.screenWidth / 2 - this.bodyWidth * 2;
        const rightGoneX = this.screenWidth / 2 + this.bodyWidth * 2;

        for (const row of this.rows) {
            if (row.leftBreaking && !row.leftGone) {
                row.left.setPosition(row.left.position.x - this.breakSpeed * deltaTime, row.left.position.y, 0);
                row.leftGone = getNodeRect(row.left).right < leftGoneX;
                if (row.leftGone) {
                    row.left.active = false;
                }
            }
            if (row.rightBreaking && !row.rightGone) {
                row.right.setPosition(row.right.position.x + this.breakSpeed * deltaTime, row.right.position.y, 0);
                row.rightGone = getNodeRect(row.right).left > rightGoneX;
                if (row.rightGone) {
                    row.right.active = false;
                }
            }
        }

        for (let i = this.rows.length - 1; i >= 0; i--) {
            if (this.rows[i].root.position.y < -this.screenHeight / 2 - this.rowSpacing) {
                this.rows[i].root.destroy();
                this.rows.splice(i, 1);
            }
        }
    }

    private checkCollisions(): void {
        if (!this.bird || this.state !== 'playing') {
            return;
        }

        const birdRect = getNodeRect(this.bird, 0.72);
        this.collectTouchedCoins(birdRect);

        if (birdRect.bottom < this.node.worldPosition.y - this.screenHeight / 2 - this.birdHeight * 0.25) {
            this.handleBottomFall();
            return;
        }

        if (this.invincibleTimer > 0) {
            return;
        }

        for (const row of this.rows) {
            const hitLeft = !row.leftBreaking && !row.leftGone && rectsIntersect(birdRect, getNodeRect(row.left, 0.9));
            const hitRight = !row.rightBreaking && !row.rightGone && rectsIntersect(birdRect, getNodeRect(row.right, 0.9));
            if (!hitLeft && !hitRight) {
                continue;
            }

            if (hitLeft) {
                row.leftBreaking = true;
            }
            if (hitRight) {
                row.rightBreaking = true;
            }

            row.scored = true;
            this.playHitSound();
            this.takeDamage();
            this.birdVelocityY = Math.max(this.birdVelocityY, this.jumpVelocity * 0.45);
            return;
        }
    }

    private collectTouchedCoins(birdRect: Rect): void {
        let collected = 0;
        for (const row of this.rows) {
            for (const coin of row.coins) {
                if (!coin.active || !rectsIntersect(birdRect, getNodeRect(coin, 0.82))) {
                    continue;
                }

                coin.active = false;
                collected += 1;
            }
        }

        if (collected <= 0) {
            return;
        }

        this.coinScore += collected;
        sys.localStorage.setItem(this.coinScoreKey, String(this.coinScore));
        this.playCoinSound();
        this.updateHud();
    }

    private handleBottomFall(): void {
        if (!this.bird) {
            return;
        }

        this.bird.setPosition(0, -this.screenHeight * 0.26, 0);
        this.birdVelocityX = 0;
        this.birdVelocityY = this.bottomBounceVelocity;

        if (this.invincibleTimer > 0) {
            return;
        }

        this.playHitSound();
        this.takeDamage();
    }

    private scorePassedRows(): void {
        if (!this.bird) {
            return;
        }

        for (const row of this.rows) {
            if (row.scored) {
                continue;
            }

            if (row.root.position.y + this.barHeight / 2 < this.bird.position.y - this.birdHeight * 0.2) {
                row.scored = true;
                this.score += 1;
                this.updateHud();
            }
        }
    }

    private takeDamage(): void {
        if (this.state !== 'playing' || this.invincibleTimer > 0) {
            return;
        }

        this.lives = Math.max(0, this.lives - 1);
        this.updateHud();

        if (this.lives <= 0) {
            this.endGame();
            return;
        }

        this.invincibleTimer = this.invincibleDuration;
        this.setBirdAlpha(90);
    }

    private endGame(): void {
        this.state = 'gameOver';
        this.invincibleTimer = 0;
        this.setBirdAlpha(255);
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            sys.localStorage.setItem(this.bestScoreKey, String(this.bestScore));
        }
        this.showGameOverPanel();
    }

    private updateHud(): void {
        if (this.scoreLabel) {
            this.scoreLabel.string = `${this.score}`;
        }
        if (this.bestLabel) {
            this.bestLabel.string = `Best ${this.bestScore}`;
        }
        if (this.coinScoreLabel) {
            this.coinScoreLabel.string = `Coin ${this.coinScore}`;
        }
        if (this.hpTextLabel) {
            this.hpTextLabel.string = `HP: ${this.lives}`;
        }
        for (let i = 0; i < this.hpNodes.length; i++) {
            this.hpNodes[i].active = i < this.lives;
        }
        this.layoutHud();
    }

    private updateBirdAnimation(deltaTime: number): void {
        if (!this.bird) {
            return;
        }

        const frames = this.activeBirdFrames.length > 0 ? this.activeBirdFrames : this.birdFrames;
        if (frames.length <= 0) {
            return;
        }

        this.birdAnimTimer += deltaTime;
        if (this.birdAnimTimer < this.birdFrameInterval) {
            return;
        }

        this.birdAnimTimer = 0;
        this.birdFrameIndex = (this.birdFrameIndex + 1) % frames.length;
        const sprite = this.bird.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = frames[this.birdFrameIndex];
        }
    }

    private updateInvincible(deltaTime: number): void {
        if (!this.bird || this.invincibleTimer <= 0) {
            return;
        }

        this.invincibleTimer = Math.max(0, this.invincibleTimer - deltaTime);
        if (this.invincibleTimer <= 0) {
            this.setBirdAlpha(255);
            return;
        }

        const blink = Math.sin((this.invincibleDuration - this.invincibleTimer) * Math.PI * 10);
        this.setBirdAlpha(blink > 0 ? 105 : 235);
    }

    private loadSavedScores(): void {
        this.bestScore = Number.parseInt(sys.localStorage.getItem(this.bestScoreKey) || '0', 10) || 0;
        this.coinScore = Number.parseInt(sys.localStorage.getItem(this.coinScoreKey) || '0', 10) || 0;
    }

    private refreshScreenSize(): void {
        const visibleSize = view.getVisibleSize();
        const nextWidth = Math.max(1, visibleSize.width);
        const nextHeight = Math.max(1, visibleSize.height);
        if (Math.abs(nextWidth - this.screenWidth) < 0.5 && Math.abs(nextHeight - this.screenHeight) < 0.5) {
            return;
        }

        this.screenWidth = nextWidth;
        this.screenHeight = nextHeight;
        this.layoutScene();
    }

    private layoutScene(): void {
        const canvasTransform = this.node.getComponent(UITransform);
        if (canvasTransform) {
            canvasTransform.setContentSize(this.screenWidth, this.screenHeight);
        }
        if (this.background) {
            const bgScale = Math.max(this.screenWidth / BACKGROUND_WIDTH, this.screenHeight / BACKGROUND_HEIGHT);
            this.background.setScale(bgScale, bgScale, 1);
            this.background.setPosition(0, 0, 0);
        }
        if (this.world) {
            getOrAddComponent(this.world, UITransform).setContentSize(this.screenWidth, this.screenHeight);
        }
        if (this.rowLayer) {
            getOrAddComponent(this.rowLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);
        }
        if (this.hudLayer) {
            getOrAddComponent(this.hudLayer, UITransform).setContentSize(this.screenWidth, this.screenHeight);
        }
        this.layoutHud();
        this.layoutGameOverPanel();
    }

    private layoutHud(): void {
        const topY = this.screenHeight / 2 - 50;
        const leftX = -this.screenWidth / 2 + 44;
        for (let i = 0; i < this.hpNodes.length; i++) {
            this.hpNodes[i].setPosition(leftX + i * 50, topY, 0);
        }
        if (this.hpTextLabel) {
            this.hpTextLabel.node.setPosition(leftX + 35, topY - 46, 0);
        }
        if (this.scoreLabel) {
            this.scoreLabel.node.setPosition(0, this.screenHeight / 2 - 70, 0);
        }
        if (this.bestLabel) {
            this.bestLabel.node.setPosition(0, topY - 74, 0);
        }
        if (this.coinScoreLabel) {
            this.coinScoreLabel.node.setPosition(this.screenWidth / 2 - 112, topY - 16, 0);
        }
    }

    private layoutGameOverPanel(): void {
        if (!this.gameOverPanel) {
            return;
        }

        const panelWidth = Math.min(500, Math.max(360, this.screenWidth * 0.78));
        let buttonWidth = Math.min(220, panelWidth * 0.5);
        let buttonHeight = buttonWidth * (64 / 142);
        const buttonGap = 16;
        const buttons = [this.restartButton, this.menuButton, this.reviveButton].filter((button): button is Node => !!button && button.active);
        const titleHeight = 58;
        const topPadding = 34;
        const titleGap = 18;
        const bottomPadding = 30;
        const maxPanelHeight = Math.max(300, this.screenHeight * 0.78);
        let buttonBlockHeight = buttons.length * buttonHeight + Math.max(0, buttons.length - 1) * buttonGap;
        let desiredPanelHeight = topPadding + titleHeight + titleGap + buttonBlockHeight + bottomPadding;

        if (desiredPanelHeight > maxPanelHeight && buttons.length > 0) {
            const availableButtonBlockHeight = maxPanelHeight - topPadding - titleHeight - titleGap - bottomPadding;
            const maxButtonHeight = (availableButtonBlockHeight - Math.max(0, buttons.length - 1) * buttonGap) / buttons.length;
            if (maxButtonHeight > 0 && maxButtonHeight < buttonHeight) {
                buttonHeight = Math.max(42, maxButtonHeight);
                buttonWidth = Math.min(buttonWidth, buttonHeight * (142 / 64));
                buttonBlockHeight = buttons.length * buttonHeight + Math.max(0, buttons.length - 1) * buttonGap;
                desiredPanelHeight = topPadding + titleHeight + titleGap + buttonBlockHeight + bottomPadding;
            }
        }

        const panelHeight = Math.min(maxPanelHeight, Math.max(panelWidth * 0.72, desiredPanelHeight));
        getOrAddComponent(this.gameOverPanel, UITransform).setContentSize(panelWidth, panelHeight);
        this.gameOverPanel.setPosition(0, Math.min(60, this.screenHeight * 0.04), 0);

        const title = this.gameOverPanel.getChildByName('WoodJumpGameOverTitle');
        if (title) {
            getOrAddComponent(title, UITransform).setContentSize(panelWidth * 0.9, titleHeight);
            title.setPosition(0, panelHeight / 2 - topPadding - titleHeight / 2, 0);
        }

        const firstY = panelHeight / 2 - topPadding - titleHeight - titleGap - buttonHeight / 2;
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            getOrAddComponent(button, UITransform).setContentSize(buttonWidth, buttonHeight);
            button.setPosition(0, firstY - i * (buttonHeight + buttonGap), 0);

            const label = button.getChildByName(`${button.name}Label`);
            if (label) {
                getOrAddComponent(label, UITransform).setContentSize(buttonWidth, buttonHeight);
                label.setPosition(0, 2, 0);
            }
        }
    }

    private showGameOverPanel(): void {
        if (this.gameOverPanel) {
            if (this.reviveButton) {
                this.reviveButton.active = this.reviveAvailable;
            }
            this.gameOverPanel.active = true;
            this.gameOverPanel.setSiblingIndex(this.gameOverPanel.parent ? this.gameOverPanel.parent.children.length - 1 : 0);
            this.layoutGameOverPanel();
        }
    }

    private hideGameOverPanel(): void {
        if (this.gameOverPanel) {
            this.gameOverPanel.active = false;
        }
        this.pressedGameOverButton = null;
    }

    private bindGameOverButton(button: Node, onClick: () => void): void {
        button.on(Node.EventType.TOUCH_START, () => {
            this.pressedGameOverButton = button;
            this.setSpriteFrame(button, this.buttonPressedFrame || this.buttonNormalFrame);
        }, this);
        button.on(Node.EventType.TOUCH_CANCEL, () => {
            if (this.pressedGameOverButton === button) {
                this.pressedGameOverButton = null;
            }
            this.setSpriteFrame(button, this.buttonNormalFrame);
        }, this);
        button.on(Node.EventType.TOUCH_END, () => {
            const shouldClick = this.pressedGameOverButton === button;
            this.pressedGameOverButton = null;
            this.setSpriteFrame(button, this.buttonNormalFrame);
            if (shouldClick) {
                onClick();
            }
        }, this);
    }

    private loadEffectSounds(): void {
        this.loadAudioClip('audio/hit', (clip) => {
            this.hitClip = clip;
        });
        this.loadAudioClip('audio/jump', (clip) => {
            this.jumpClip = clip;
        });
        this.loadAudioClip('audio/coin', (clip) => {
            this.coinClip = clip;
        });
    }

    private loadAudioClip(path: string, onLoaded: (clip: AudioClip) => void): void {
        resources.load(path, AudioClip, (error, clip) => {
            if (error) {
                console.warn(`Failed to load audio clip: ${path}`, error);
                return;
            }

            onLoaded(clip);
        });
    }

    private playHitSound(): void {
        if (!AudioSettings.isSoundEnabled() || !this.audioSource || !this.hitClip || this.hitSoundTimer > 0) {
            return;
        }

        this.hitSoundTimer = this.hitSoundCooldown;
        this.audioSource.playOneShot(this.hitClip, this.hitSoundVolume);
    }

    private playJumpSound(): void {
        if (!AudioSettings.isSoundEnabled() || !this.audioSource || !this.jumpClip) {
            return;
        }

        this.audioSource.playOneShot(this.jumpClip, this.jumpSoundVolume);
    }

    private playCoinSound(): void {
        if (!AudioSettings.isSoundEnabled() || !this.audioSource || !this.coinClip) {
            return;
        }

        this.audioSource.playOneShot(this.coinClip, this.coinSoundVolume);
    }

    private getSelectedBirdFrames(): SpriteFrame[] {
        const selectedBird = sys.localStorage.getItem(this.selectedBirdKey) || 'default';
        const ownedBirds = sys.localStorage.getItem(this.ownedBirdsKey) || 'default';
        if (ownedBirds.indexOf(selectedBird) < 0) {
            return this.birdFrames;
        }

        if (selectedBird === 'red' && this.redBirdFrames.length > 0) {
            return this.redBirdFrames;
        }
        if (selectedBird === 'blue' && this.blueBirdFrames.length > 0) {
            return this.blueBirdFrames;
        }
        if (selectedBird === 'purple' && this.purpleBirdFrames.length > 0) {
            return this.purpleBirdFrames;
        }

        return this.birdFrames;
    }

    private createLabel(name: string, text: string, size: number, position: Vec3, parent: Node = this.node): Label {
        const node = getOrCreateChild(parent, name);
        node.layer = parent.layer;
        node.setPosition(position);
        getOrAddComponent(node, UITransform).setContentSize(520, size + 20);
        const label = getOrAddComponent(node, Label);
        label.string = text;
        label.fontSize = size;
        label.lineHeight = size + 8;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private createSpriteNode(name: string, frame: SpriteFrame | null, parent: Node | null, width: number, height: number): Node {
        const node = parent ? getOrCreateChild(parent, name) : new Node(name);
        node.layer = parent ? parent.layer : this.node.layer;
        getOrAddComponent(node, UITransform).setContentSize(width, height);
        const sprite = getOrAddComponent(node, Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (frame) {
            sprite.spriteFrame = frame;
        }
        return node;
    }

    private setSpriteFrame(node: Node | null, frame: SpriteFrame | null): void {
        if (!node || !frame) {
            return;
        }

        const sprite = node.getComponent(Sprite);
        if (sprite) {
            sprite.spriteFrame = frame;
        }
    }

    private setBirdAlpha(alpha: number): void {
        if (!this.bird) {
            return;
        }

        const sprite = this.bird.getComponent(Sprite);
        if (sprite) {
            const color = sprite.color.clone();
            color.a = alpha;
            sprite.color = color;
        }
    }
}

interface Rect {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

function getNodeRect(node: Node, shrink = 1): Rect {
    const transform = node.getComponent(UITransform);
    const width = (transform?.width || 0) * Math.abs(node.worldScale.x) * shrink;
    const height = (transform?.height || 0) * Math.abs(node.worldScale.y) * shrink;
    const center = node.worldPosition;

    return {
        left: center.x - width / 2,
        right: center.x + width / 2,
        top: center.y + height / 2,
        bottom: center.y - height / 2,
    };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
    return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}

function getOrCreateChild(parent: Node, name: string): Node {
    const existing = parent.getChildByName(name);
    if (existing) {
        return existing;
    }

    const child = new Node(name);
    child.setParent(parent);
    return child;
}

function getOrAddComponent<T extends Component>(node: Node, type: new () => T): T {
    return node.getComponent(type) || node.addComponent(type);
}
