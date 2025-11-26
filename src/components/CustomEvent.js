import React from "react";
import useMediaQuery from "@mui/material/useMediaQuery";

const getInitials = (name) => {
  if (!name) return "";
  const names = name.split(" ");
  if (names.length > 1) {
    return names[0][0] + names[1][0];
  }
  return names[0][0];
};

const CustomEvent = ({ event, isPrintView }) => {
  const { title, tutor, startTime, endTime, location, participants } = event; // Assuming these fields exist
  const isMobile = useMediaQuery("(max-width:600px)");

  if (isPrintView) {
    if (isMobile) {
      return (
        <div
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            wordWrap: "break-word",
            whiteSpace: "normal",
            overflowWrap: "break-word",
          }}
        >
          {title}
        </div>
      );
    }
    // Custom structure for the print view
    return (
      <div style={{ fontSize: "15px" }}>
        <div
          style={{
            fontWeight: "bold",
            wordWrap: "break-word",
            whiteSpace: "normal",
            overflowWrap: "break-word",
          }}
        >
          {title}
        </div>
        <div>
          <div style={{ fontSize: "14px", fontWeight: "500" }}>{tutor} </div>{" "}
          {/* Display tutor's name */}
        </div>
        {/* <div> 
          <strong>Time:</strong>{" "}
          <strong>
            {startTime} - {endTime}
          </strong>{" "}
        </div> */}
        <div style={{ fontSize: "13px", fontWeight: "500" }}>{location}</div>
      </div>
    );
  }

  if (!isPrintView && isMobile) {
    return (
      <div
        style={{
          fontSize: "12px",
          fontWeight: "bold",
          wordWrap: "break-word",
          whiteSpace: "normal",
          overflowWrap: "break-word",
        }}
      >
        {title}
      </div>
    );
  }

  // Default structure for other views
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "5px", fontSize: "14px" }}>
      <div
        style={{
          fontSize: "16px",
          fontWeight: "bold",
          wordWrap: "break-word",
          whiteSpace: "normal",
          overflowWrap: "break-word",
        }}
      >
        {title}
      </div>
      {/* <div style={{ fontSize: "14px" }}>
        {participants.map((participant, index) => (
          <span key={index} style={{ marginRight: "5px" }}>
            {getInitials(participant.name)}
          </span>
        ))}
      </div> */}
      <div>
        <div style={{ fontSize: "14px", fontWeight: "500" }}>{tutor} </div>{" "}
        {/* Display tutor's name */}
      </div>
      {/* <div>
          <strong>Time:</strong>{" "}
          <strong>
            {startTime} - {endTime}
          </strong>{" "}
        </div> */}
      <div style={{ fontSize: "14px", fontWeight: "500" }}>{location}</div>
    </div>
  );
};

export default CustomEvent;
