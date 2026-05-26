import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        heatmap: {
          0: "#ebedf0",
          1: "#9be9a8",
          2: "#40c463",
          3: "#30a14e",
          4: "#216e39",
          skip: "#fde68a",
          miss: "#f3f4f6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
