export interface VillagerData {
  id: number;
  name: string;
  role: "farmer" | "builder";
  age: number;
  hunger: number;
  health: number;
  x: number;
  y: number;
  state: "idle" | "moving" | "eating" | "working" | "dead";
}

export interface GameEventData {
  type: string;
  message: string;
  tick: number;
}

export interface WorldStateData {
  tick: number;
  timeOfDay: number;
  dayCount: number;
  rainLevel: number;
  grid: string[][];
  fires: boolean[][];
  villagers: VillagerData[];
  resources: {
    wood: number;
    food: number;
    water: number;
  };
  population: number;
  events: GameEventData[];
}

export type ActionType = "spawn_tree" | "build_house" | "trigger_fire" | "trigger_rain";

export interface ActionPayload {
  type: ActionType;
  x: number;
  y: number;
}
