import { serveDir, serveFile } from "jsr:@std/http/file-server";
import { qrPng } from "jsr:@sigmasd/qrpng@0.1.3";

function getLocalAddr() {
  return Deno.networkInterfaces().filter((int) =>
    int.name !== "lo" && int.family === "IPv4"
  ).at(0)?.address || "localhost";
}

const emptyPage = `\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>No File Found</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #f0f0f0;
    }
    .message {
      text-align: center;
      padding: 20px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="message">
    <h1>No File Found</h1>
    <p>Please drop a file on the application first.</p>
  </div>
</body>
</html>`;

if (import.meta.main) {
  let filePath: string;

  Deno.serve({
    port: 0,
    onListen: (addr) => {
      const serverAddr = `http://${getLocalAddr()}:${addr.port}`;
      console.log("[worker] HTTP server running. Access it at:", serverAddr);
      Deno.writeFileSync(
        "/tmp/qr.png",
        qrPng(new TextEncoder().encode(serverAddr)),
      );
    },
  }, async (req): Promise<Response> => {
    console.log("[worker] serving file:", filePath);
    try {
      const meta = await Deno.stat(filePath);
      if (meta.isFile) {
        return serveFile(req, filePath);
      }
      return serveDir(req, {
        fsRoot: filePath,
        showDirListing: true,
      });
    } catch {
      return new Response(emptyPage, {
        status: 404,
        headers: { "Content-Type": "text/html" },
      });
    }
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
}
