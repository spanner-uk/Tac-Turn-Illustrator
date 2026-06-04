import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2e6f58"
    },
    secondary: {
      main: "#1f7a8c"
    },
    background: {
      default: "#f5f7f6"
    }
  },
  shape: {
    borderRadius: 8
  }
});
