import type { MuxType } from "../modes/common";

export interface SendConfig {
  mux: MuxType;
  alwaysCopy: boolean;
}
