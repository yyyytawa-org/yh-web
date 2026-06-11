import protobuf from 'protobufjs'

const COMMON_PROTO = `
message Status {
  uint64 number = 1;
  uint64 code = 2;
  string msg = 3;
}

message Tag {
  uint64 id = 1;
  string text = 3;
  string color = 4;
}
`

/**
 * Prepend syntax declarations and common messages (Status, Tag)
 * to a local protobuf string and return the parsed root.
 */
export function parseProto(localBody: string) {
  const fullProto = `syntax = "proto3";\n${COMMON_PROTO}\n${localBody}`
  return protobuf.parse(fullProto).root
}
