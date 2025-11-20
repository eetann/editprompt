import type { MuxType } from "../modes/common";

export interface SendConfig {
  targetPane?: string;
  mux: MuxType;
  alwaysCopy: boolean;
}
