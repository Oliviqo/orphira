export type OrphiraPermission =
  | 'player:read'
  | 'player:control'
  | 'timeline:read'
  | 'timeline:control'
  | 'queue:read'
  | 'queue:write'
  | 'library:read'
  | 'playlists:read'
  | 'playlists:write'
  | 'equalizer:read'
  | 'equalizer:control'
  | 'equalizer:presets'
  | 'equalizer:visualizer'
  | 'lyrics:read'
  | 'storage'
  | 'network'
  | 'ui:notifications'
  | 'ui:commands'
  | 'ui:settings'
  | 'ui:player'
  | 'ui:sidebar'
  | 'ui:context-menu'
  | 'ui:views'
  | 'ui:layout'
  | 'themes:register'
  | 'locales:register'
  | 'providers:metadata'
  | 'providers:lyrics'
  | 'providers:artwork';

export interface PublicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  year: number | string | null;
  genre: string | null;
  trackNumber: number | null;
  discNumber: number | null;
}

export interface Playlist {
  id: string;
  name: string;
  pinned: boolean;
  trackIds: string[];
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  shuffle: boolean;
  repeat: number;
}

export interface TimelineState {
  currentTime: number;
  duration: number;
  seeking: boolean;
}

export interface NetworkResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface LayoutComponent {
  id: string;
  available: boolean;
  container: string;
  movableTo: string[];
}

export interface LayoutPreset {
  id: string;
  name?: string;
  hidden?: string[];
  shown?: string[];
  moves?: Record<string, string>;
  order?: Record<string, string[]>;
}

export interface SettingsControl {
  id: string;
  type: 'toggle' | 'text' | 'password' | 'select' | 'slider';
  label?: string;
  description?: string;
  default?: unknown;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{
    value: string | number;
    label?: string;
  }>;
  onChange?: (
    event: {
      id: string;
      value: unknown;
    }
  ) => void | Promise<void>;
}

export interface OrphiraPluginApi {
  app: {
    getInfo(): Promise<{
      name: string;
      version: string;
      pluginApiVersion: number;
      language: string;
    }>;
  };

  player: {
    getCurrentTrack(): Promise<PublicTrack | null>;
    getState(): Promise<PlayerState>;
    play(): Promise<boolean>;
    pause(): Promise<boolean>;
    next(): Promise<boolean>;
    previous(): Promise<boolean>;
    setVolume(value: number): Promise<number>;
    setPlaybackRate(value: number): Promise<number>;
  };

  timeline: {
    get(): Promise<TimelineState>;
    seek(seconds: number): Promise<boolean>;
  };

  queue: {
    get(): Promise<PublicTrack[]>;
    addNext(trackIds: string[]): Promise<boolean>;
    addEnd(trackIds: string[]): Promise<boolean>;
    clear(): Promise<boolean>;
  };

  library: {
    getTracks(): Promise<PublicTrack[]>;
    getTrack(trackId: string): Promise<PublicTrack | null>;
  };

  playlists: {
    get(): Promise<Playlist[]>;
    create(name: string): Promise<Playlist>;
    remove(playlistId: string): Promise<boolean>;
    addTracks(
      playlistId: string,
      trackIds: string[]
    ): Promise<Playlist>;
  };

  equalizer: {
    get(): Promise<Record<string, unknown>>;
    setBand(
      index: number,
      gain: number
    ): Promise<number>;
    setPreamp(value: number): Promise<number>;
    setQ(value: number): Promise<number>;
    setBypass(value: boolean): Promise<boolean>;
    applyPreset(gains: number[]): Promise<number[]>;
    getSpectrum(): Promise<number[]>;
    registerVisualizerMode(definition: {
      id: string;
      name?: string;
      type: 'bars' | 'line' | 'dots';
      color?: string;
      secondaryColor?: string;
    }): Promise<string>;
  };

  lyrics: {
    getCurrent(): Promise<Array<{
      time: number;
      text: string;
    }>>;
  };

  storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    set<T = unknown>(
      key: string,
      value: T
    ): Promise<boolean>;
    delete(key: string): Promise<boolean>;
  };

  network: {
    fetch(options: {
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
      headers?: Record<string, string>;
      body?: string | null;
    }): Promise<NetworkResponse>;
  };

  notifications: {
    show(
      message: string,
      type?: 'info' | 'success' | 'warning' | 'error'
    ): Promise<boolean>;
  };

  commands: {
    register(definition: {
      id: string;
      title: string;
      onExecute?: (
        payload?: unknown
      ) => unknown | Promise<unknown>;
    }): Promise<string>;
  };

  ui: {
    player: {
      addAction(definition: {
        id: string;
        title: string;
        icon?: string;
        onClick?: () => unknown | Promise<unknown>;
      }): Promise<string>;
    };

    sidebar: {
      addAction(definition: {
        id: string;
        title: string;
        icon?: string;
        onClick?: () => unknown | Promise<unknown>;
      }): Promise<string>;
    };

    contextMenu: {
      addTrackAction(definition: {
        id: string;
        title: string;
        onClick?: (
          context: {
            track: PublicTrack;
          }
        ) => unknown | Promise<unknown>;
      }): Promise<string>;
    };

    settings: {
      addSection(definition: {
        id: string;
        title: string;
        controls?: SettingsControl[];
      }): Promise<string>;
    };

    views: {
      open(viewId: string): Promise<boolean>;
    };

    layout: {
      getComponents(): Promise<LayoutComponent[]>;
      hide(componentId: string): Promise<boolean>;
      show(componentId: string): Promise<boolean>;
      move(
        componentId: string,
        containerId: string
      ): Promise<boolean>;
      setOrder(
        containerId: string,
        componentIds: string[]
      ): Promise<boolean>;
      registerPreset(
        definition: LayoutPreset
      ): Promise<string>;
      applyPreset(
        presetId: string
      ): Promise<boolean>;
      reset(): Promise<boolean>;
    };
  };

  events: {
    on<T = unknown>(
      eventName: string,
      handler: (
        payload: T
      ) => void | Promise<void>
    ): () => void;
  };
}

export interface OrphiraPluginModule {
  activate(
    api: OrphiraPluginApi
  ): void | Promise<void>;

  deactivate?(): void | Promise<void>;
}

export interface OrphiraPluginManifest {
  manifestVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  entry?: string;

  orphira: {
    apiVersion: 2;
    minimumVersion: string;
  };

  permissions?: OrphiraPermission[];

  network?: {
    hosts?: string[];
  };

  contributes?: {
    commands?: Array<{
      id: string;
      title: string;
    }>;

    themes?: Array<{
      id: string;
      name: string;
      file: string;
    }>;

    locales?: Array<{
      language: string;
      file: string;
    }>;

    views?: Array<{
      id: string;
      title: string;
      file: string;
    }>;
  };
}