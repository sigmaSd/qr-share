import { instantiate as instantiateQr } from "/home/mrcool/dev/lab/fff/lib/rs_lib.generated.js";
const { qr } = instantiateQr();

let filePath: string;

const port = 8080;
const handler = async (): Promise<Response> => {
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
};

console.log("HTTP server running. Access it at: http://localhost:8080/");
Deno.serve({
  port,
  onListen: (addr) => {
    const serverAddr = `http://${addr.hostname}:${addr.port}`;
    Deno.writeFileSync("/tmp/qr.png", qr(new TextEncoder().encode(serverAddr)));
  },
}, handler);

//@ts-ignore worker
self.onmessage = (event) => {
  console.log("[worker] recived msg:", event.data);
  switch (event.data.type) {
    case "file":
      filePath = event.data.path;
      break;
  }
};
