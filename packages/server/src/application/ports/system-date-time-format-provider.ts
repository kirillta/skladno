import type { SystemDateTimeFormat } from "@skladno/shared";


export interface SystemDateTimeFormatProvider {
    read(): Promise<SystemDateTimeFormat>;
}
