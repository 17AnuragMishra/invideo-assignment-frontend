import { useState, useRef, useEffect } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import init, { calculate } from "rust-calc";
import "./App.css";

function App() {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState("");
  const [description, setDescription] = useState("");
  const [fragmentShaderCode, setFragmentShaderCode] = useState("");
  const [shaderError, setShaderError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    init().then(() => {
      console.log("WASM initialized");
    }).catch(e => console.error("WASM init failed:", e));
  }, []);

  const handleCalculate = () => {
    try {
      const res = calculate(expression);
      setResult(res.toString());
    } catch (e) {
      setResult("Error: " + e);
    }
  };

  const fetchShader = async () => {
    try {
      const res = await fetch("http://localhost:4000/api/shader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setFragmentShaderCode(data.shader);
      setShaderError("");
    } catch (e) {
      setShaderError("Fetch failed: API 404");
      // Mock variety if LLM fails
      if (description.toLowerCase().includes("gradient")) {
        setFragmentShaderCode(`
          precision mediump float;
          void main() {
            vec2 uv = gl_FragCoord.xy / 400.0;
            gl_FragColor = vec4(uv.x, uv.y, 0.5, 1.0);
          }
        `);
      } else if (description.toLowerCase().includes("blue")) {
        setFragmentShaderCode(`
          precision mediump float;
          void main() {
            gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
          }
        `);
      }
    }
  };

  useEffect(() => {
    if (!fragmentShaderCode || !canvasRef.current) return;

    const gl = canvasRef.current.getContext("webgl");
    if (!gl) {
      setShaderError("WebGL not supported");
      return;
    }

    const vertexShaderCode = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderCode);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderCode);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      setShaderError("Shader failed: " + gl.getShaderInfoLog(fragmentShader));
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [fragmentShaderCode]);

  return (
    <div className="app-container">
      <h1 className="app-title">Shader & Calculator Playground</h1>
      <Tabs className="custom-tabs">
        <TabList className="custom-tab-list">
          <Tab className="custom-tab" selectedClassName="custom-tab-selected">Rust Calculator</Tab>
          <Tab className="custom-tab" selectedClassName="custom-tab-selected">Text-to-Shader</Tab>
        </TabList>

        <TabPanel className="tab-panel">
          <div className="calculator-section">
            <h2>Calculate with Rust</h2>
            <input
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="e.g., 2 + 2"
              className="input-field"
            />
            <button onClick={handleCalculate} className="action-button">Calculate</button>
            <p className="result-text">Result: <span className={result.startsWith("Error") ? "error" : "success"}>{result || "Enter an expression"}</span></p>
          </div>
        </TabPanel>

        <TabPanel className="tab-panel">
          <div className="shader-section">
            <h2>Create a Shader</h2>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., A gradient background"
              className="input-field"
            />
            <button onClick={fetchShader} className="action-button">Generate Shader</button>
            <div className="canvas-container">
              <canvas ref={canvasRef} width={400} height={400} className="shader-canvas" />
              <pre className={shaderError ? "shader-code error" : "shader-code"}>{shaderError || fragmentShaderCode || "// Enter a description to generate a shader"}</pre>
            </div>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}

export default App;