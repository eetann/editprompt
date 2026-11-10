import type { MuxType } from "../utils/mux";

export interface SendConfig {
  mux: MuxType;
  alwaysCopy: boolean;
  sendKeyDelay: number;
}
