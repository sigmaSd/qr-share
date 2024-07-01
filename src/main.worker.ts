import { qrPng } from "jsr:@sigmasd/qrpng@0.1.3";

let filePath: string;

Deno.serve({
  port: 0,
  onListen: (addr) => {
    const serverAddr = `http://${addr.hostname}:${addr.port}`;
    console.log("[worker] HTTP server running. Access it at:", serverAddr);
    Deno.writeFileSync(
      "/tmp/qr.png",
      qrPng(new TextEncoder().encode(serverAddr)),
    );
  },
}, async (): Promise<Response> => {
  const headers = new Headers();
  headers.set("Content-Type", "application/octet-stream");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${filePath.split("/").pop()}"`,
  );

  const file = await Deno.open(filePath);

  return new Response(file.readable, {
    status: 200,
    headers,
  });
});

//@ts-ignore worker
self.onmessage = (event) => {
  console.log("[worker] recived msg:", event.data);
  switch (event.data.type) {
    case "file":
      filePath = event.data.path;
      break;
  }
};
