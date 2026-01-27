import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import { ChromePicker } from "react-color";
import { styled } from "@mui/material/styles";
import "../../../assets/ColorPickerModal.css";

// Styled component for custom dialog paper
const StyledDialog = styled(Dialog)(({ theme }) => ({
  "& .MuiDialog-paper": {
    width: "fit-content", // Set width to fit content
    maxWidth: "90vw", // Optional: ensure it doesn't get too wide
    padding: theme.spacing(2), // Optional: add padding for better spacing
  },
}));

const ColorPickerModal = ({ open, onClose, selectedColor, onSelectColor }) => {
  const handleChangeComplete = (color) => {
    onSelectColor(color.hex);
  };

  return (
    <StyledDialog open={open} onClose={onClose} fullWidth={false} maxWidth={false}>
      <DialogTitle>Select Event Color</DialogTitle>
      <DialogContent sx={{ backgroundColor: "#fff" }}>
        <ChromePicker color={selectedColor} onChangeComplete={handleChangeComplete} disableAlpha />
      </DialogContent>
      <DialogActions style={{ justifyContent: "space-between" }}>
        <Button onClick={onClose} color="primary" variant="contained" style={{ color: "#fff" }}>
          Ok
        </Button>
        <Button onClick={onClose} color="primary" variant="outlined" style={{ color: "#1A73E8" }}>
          Close
        </Button>
      </DialogActions>
    </StyledDialog>
  );
};

export default ColorPickerModal;
