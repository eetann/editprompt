import type { MuxType } from "../modules/process";

export interface SendConfig {
  targetPane?: string;
  mux: MuxType;
  alwaysCopy: boolean;
}
