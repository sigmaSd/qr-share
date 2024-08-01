import { serveDir, serveFile } from "jsr:@std/http@0.224.5/file-server";
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
  <title>No Content Found</title>
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
    <h1>No Content Found</h1>
    <p>Please drop a file or paste text in the application first.</p>
  </div>
</body>
</html>`;

if (import.meta.main) {
  let filePath: string | null = null;
  let textContent: string | null = null;
  let qrPath: string;

  const startServer = () => {
    Deno.serve({
      port: 0,
      onListen: async (addr) => {
        const serverAddr = `http://${getLocalAddr()}:${addr.port}`;
        console.log("[worker] HTTP server running. Access it at:", serverAddr);
        await Deno.writeFile(
          qrPath,
          qrPng(new TextEncoder().encode(serverAddr)),
        );
      },
    }, async (req): Promise<Response> => {
      if (!filePath && !textContent) {
        return new Response(emptyPage, {
          status: 404,
          headers: { "Content-Type": "text/html" },
        });
      }
      if (new URL(req.url).pathname !== "/") {
        return new Response("Not Found", { status: 404 });
      }

      if (textContent) {
        console.log("[worker] serving text content");
        return new Response(textContent, {
          headers: { "Content-Type": "text/plain" },
        });
      }

      if (filePath) {
        console.log("[worker] serving file:", filePath);
        try {
          const meta = await Deno.stat(filePath);
          if (meta.isFile) {
            return serveFile(req, filePath);
          }
          if (meta.isDirectory) {
            return serveDir(req, {
              fsRoot: filePath,
              showDirListing: true,
            });
          }
        } catch (error) {
          console.error("[worker] Error accessing file:", error);
          return new Response("File not found", { status: 404 });
        }
      }

      // This should never happen, but just in case
      return new Response("Internal Server Error", { status: 500 });
    });
    //@ts-ignore worker
    self.postMessage({ type: "start" });
  };

  //@ts-ignore worker
  self.onmessage = (event) => {
    console.log("[worker] received msg:", event.data);
    switch (event.data.type) {
      case "file":
        filePath = event.data.path;
        textContent = null; // Reset text content when a file is shared
        break;
      case "text":
        textContent = event.data.content;
        filePath = null; // Reset file path when text is shared
        break;
      case "qrPath":
        qrPath = event.data.path;
        startServer();
        break;
    }
  };
}
