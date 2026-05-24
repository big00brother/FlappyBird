import { AudioClip, AudioSource, director, Node, resources, sys } from 'cc';

export class AudioSettings {
    public static readonly musicEnabledKey = 'flappy_music_enabled';
    public static readonly soundEnabledKey = 'flappy_sound_enabled';

    public static isMusicEnabled(): boolean {
        return sys.localStorage.getItem(this.musicEnabledKey) !== 'false';
    }

    public static setMusicEnabled(enabled: boolean): void {
        sys.localStorage.setItem(this.musicEnabledKey, enabled ? 'true' : 'false');
    }

    public static isSoundEnabled(): boolean {
        return sys.localStorage.getItem(this.soundEnabledKey) !== 'false';
    }

    public static setSoundEnabled(enabled: boolean): void {
        sys.localStorage.setItem(this.soundEnabledKey, enabled ? 'true' : 'false');
    }
}

export class AudioManager {
    private static node: Node | null = null;
    private static musicSource: AudioSource | null = null;
    private static musicClip: AudioClip | null = null;
    private static loadingMusic = false;
    private static readonly musicVolume = 0.35;

    public static ensure(): void {
        if (!this.node || !this.node.isValid) {
            this.node = new Node('AudioManager');
            director.addPersistRootNode(this.node);
            this.musicSource = this.node.addComponent(AudioSource);
            this.musicSource.loop = true;
        }

        this.loadBackgroundMusic();
        this.refreshMusic();
    }

    public static refreshMusic(): void {
        if (!this.musicSource) {
            return;
        }

        this.loadBackgroundMusic();
        this.musicSource.volume = this.musicVolume;
        if (!AudioSettings.isMusicEnabled() || !this.musicClip) {
            this.musicSource.stop();
            return;
        }

        this.musicSource.clip = this.musicClip;
        this.musicSource.loop = true;
        if (this.musicSource.playing) {
            return;
        }
        this.musicSource.play();
    }

    private static loadBackgroundMusic(): void {
        if (this.musicClip || this.loadingMusic) {
            return;
        }

        this.loadingMusic = true;
        resources.load('audio/bgm', AudioClip, (error, clip) => {
            this.loadingMusic = false;
            if (error || !clip) {
                return;
            }

            this.musicClip = clip;
            this.refreshMusic();
        });
    }
}
