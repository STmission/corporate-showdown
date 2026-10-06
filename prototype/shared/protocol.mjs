export const PROTOCOL_VERSION=3;
export const RULES_VERSION='rules-0.6.2';
export const SIMULATION_HZ=30;
export const SNAPSHOT_HZ=15;
export const INPUT_HZ=30;
export function compatible(data){return data?.protocolVersion===PROTOCOL_VERSION&&data?.rulesVersion===RULES_VERSION;}
