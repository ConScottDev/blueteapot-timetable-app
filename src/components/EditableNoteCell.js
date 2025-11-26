import React, { useState } from "react";
import MDTypography from "./MDTypography";
import useMediaQuery from "@mui/material/useMediaQuery";
import EditIcon from "@mui/icons-material/Edit";

const EditableNoteCell = ({ note, onNoteChange, cellId }) => {
  console.log("cell ID", cellId);
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(note);
  const isMobile = useMediaQuery("(max-width:600px)");

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleChange = (event) => {
    console.log("newID", event.target.id);
    const id = event.target.id;
    const value = event.target.value;

    console.log("editable value", value); // This should log the correct text value
    setNoteText(value);
    onNoteChange(id, value); // Ensure value is correct here
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <div className="note-cell-wrapper" onClick={handleClick}>
      {isEditing ? (
        <textarea
          id={cellId}
          value={noteText}
          onChange={handleChange}
          onBlur={handleBlur}
          autoFocus
          className="note-textarea"
          rows={12} // Adjust based on your needs
        />
      ) : (
        <MDTypography p={1} variant="body2" fontWeight="medium">
          {noteText || (isMobile ? <EditIcon fontSize="small" /> : "Click to add note")}
        </MDTypography>
      )}
    </div>
  );
};

export default EditableNoteCell;
