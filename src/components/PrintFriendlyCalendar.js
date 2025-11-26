import React from "react";
import ReactToPrint from "react-to-print";
import CustomPrintView from "./CustomPrintView"; // Adjust import path
import { PrintNotesProvider } from "context/PrintNotesContext";

class PrintComponent extends React.Component {
  render() {
    return (
      <PrintNotesProvider>
        <div>
          <ReactToPrint
            trigger={() => <button>Print Calendar</button>}
            content={() => this.componentRef}
          />
          <CustomPrintView
            ref={(el) => (this.componentRef = el)}
            // Pass necessary props for CustomPrintView
            date={new Date()} // Example date
            events={[]} // Example events
            // Include other props as needed
          />
        </div>
      </PrintNotesProvider>
    );
  }
}

export default PrintComponent;
