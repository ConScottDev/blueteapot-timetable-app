import React, { createRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { DatePicker } from "@mui/x-date-pickers";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import PropTypes from "prop-types";
import clsx from "clsx";
import chunk from "lodash/chunk";
import { navigate, views } from "react-big-calendar/lib/utils/constants";
import { notify } from "react-big-calendar/lib/utils/helpers";
import getPosition from "dom-helpers/position";
import * as animationFrame from "dom-helpers/animationFrame";
import PopOverlay from "react-big-calendar/lib/PopOverlay";
import DateContentRow from "react-big-calendar/lib/DateContentRow";
import Header from "react-big-calendar/lib/Header";
import DateHeader from "react-big-calendar/lib/DateHeader";
import ReactToPrint from "react-to-print";
import { inRange, sortWeekEvents } from "react-big-calendar/lib/utils/eventLevels";
import "../assets/print.css";

import { Icon, IconButton, TextField, Menu } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PrintIcon from "@mui/icons-material/Print";
import ImageIcon from "@mui/icons-material/Image";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

import MDTypography from "./MDTypography";
import EditIcon from "@mui/icons-material/Edit";
import EditableNoteCell from "./EditableNoteCell";
import NotificationItem from "examples/Items/NotificationItem";
import logo from "../assets/images/blue-teapot-logo-png-01.png"; // Adjust path as needed
import { de, enGB, zhCN } from "date-fns/locale"; // Utility functions
import { useActor } from "context/ActorProvider";
import { ActorContext } from "context/ActorProvider";
import { PrintNotesContext } from "context/PrintNotesContext";
import { startOfDay, endOfDay } from "date-fns";

// const eventsForWeek = (evts, start, end, accessors, localizer) =>
//   evts.filter((e) => inRange(e, start, end, accessors, localizer));

const eventsForWeek = (evts, start, end, accessors, localizer) =>
  evts.filter((e) => inRange(e, startOfDay(start), endOfDay(end), accessors, localizer));

class CustomPrintView extends React.Component {
  static contextType = PrintNotesContext;

  constructor(...args) {
    super(...args);

    this.state = {
      rowLimit: 5,
      needLimitMeasure: true,
      date: null,
      selectedDate: new Date(), // New state for selected date
      range: {
        start: new Date(),
        end: this.props.localizer.add(new Date(), 20, "day"),
      },
      overlay: null,
      notesForDays: {}, // Add notes field
      currentNoteCell: null, // Track the currently edited note cell
      currentNote: "",
      numberOfPages: 1, // New state for the number of pages to print
      exportAnchorEl: null,
    };
    this.containerRef = createRef();
    this.slotRowRef = createRef();
    this.printRef = createRef(); // Reference for the print component
    this.exportRef = createRef(); // visible export capture target
    this.reactToPrintRef = null; // to trigger ReactToPrint programmatically
    this._bgRows = [];
    this._pendingSelection = [];
  }

  openExportMenu = (e) => this.setState({ exportAnchorEl: e.currentTarget });
  closeExportMenu = () => this.setState({ exportAnchorEl: null });

  handlePrint = () => {
    this.closeExportMenu();
    // Trigger ReactToPrint’s print
    if (this.reactToPrintRef?.handlePrint) this.reactToPrintRef.handlePrint();
  };

  exportPNG = async () => {
    this.closeExportMenu();
    const node = this.exportRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      logging: false,
      onclone: (documentClone) => this.prepareCloneForExport(documentClone),
    });
    const dataURL = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "schedule.png";
    a.click();
  };

  exportPDF = async () => {
    this.closeExportMenu();
    const node = this.exportRef.current;
    if (!node) return;
    const canvas = await html2canvas(node, {
      backgroundColor: "#ffffff",
      scale: window.devicePixelRatio || 2,
      useCORS: true,
      logging: false,
      onclone: (documentClone) => this.prepareCloneForExport(documentClone),
    });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = Math.min(pageW / imgW, pageH / imgH);
    const w = imgW * ratio;
    const h = imgH * ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    pdf.addImage(imgData, "PNG", x, y, w, h, undefined, "FAST");
    pdf.save("schedule.pdf");
  };

  prepareCloneForExport = (documentClone) => {
    const exportOnlyElements = documentClone.querySelectorAll(".export-only");
    exportOnlyElements.forEach((element) => {
      element.style.display = "flex";
    });
  };

  static getDerivedStateFromProps({ date, localizer }, state) {
    return {
      date,
      needLimitMeasure: localizer.neq(date, state.date, "month"),
    };
  }

  componentDidMount() {
    let running;

    if (this.state.needLimitMeasure) this.measureRowLimit(this.props);

    window.addEventListener(
      "resize",
      (this._resizeListener = () => {
        if (!running) {
          animationFrame.request(() => {
            running = false;
            this.setState({ needLimitMeasure: true }); //eslint-disable-line
          });
        }
      }),
      false
    );
  }

  componentDidUpdate() {
    if (this.state.needLimitMeasure) this.measureRowLimit(this.props);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this._resizeListener, false);
  }

  handleNoteChange = (cellId, noteText) => {
    const { updateNote } = this.context || {};
    if (typeof updateNote === "function") {
      updateNote(cellId, noteText);
    }
  };

  handleDateChange = (newDate) => {
    const { localizer } = this.props;

    const normalizedDate = new Date(newDate);
    normalizedDate.setHours(0, 0, 0, 0); // Set time to midnight
    console.log("Date", normalizedDate);
    // Calculate the start and end date for a 3-week range
    const start = normalizedDate;
    const end = localizer.add(start, 20, "day"); // Calculate 3 weeks ahead (21 days total)

    this.setState({
      selectedDate: newDate,
      range: { start, end },
    });
  };

  getCustomWeekArray = (start, end) => {
    const days = [];
    let currentDate = start;

    // Iterate over the date range and exclude Sundays
    while (currentDate <= end) {
      if (currentDate.getDay() !== 0) {
        // Exclude Sundays
        days.push(currentDate);
      }
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Chunk the array into weeks of 6 days each (Monday to Saturday)
    return this.chunkArray(days, 6);
  };

  // Utility function to chunk an array into smaller arrays of a given size
  chunkArray = (array, chunkSize) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };

  updateCalendarRange = (selectedDate) => {
    const { localizer } = this.props;

    // Set the start of the view to the selected date
    const startOfView = selectedDate;

    // Calculate the end of the view range (21 days from the selected date)
    const endOfView = localizer.add(startOfView, 20, "day"); // 20 days ahead to cover 3 weeks (21 days total)

    this.setState({
      date: startOfView,
      range: { start: startOfView, end: endOfView },
    });
  };

  getContainer = () => this.containerRef.current;

  renderSingleNoteCell(weekIdx, calendarId) {
    const noteKey = `${calendarId}-${weekIdx}`;
    const notes = (this.context && this.context.notes) || {};
    return (
      <EditableNoteCell
        note={notes[noteKey] || ""}
        onNoteChange={(id, newNote) => this.handleNoteChange(id, newNote)} // Handle note change
        cellId={noteKey} // Use the combined key as the cellId
      />
    );
  }

  render() {
    const { className, localizer } = this.props;
    const { selectedDate, numberOfPages } = this.state;

    if (!selectedDate) {
      return null;
    }

    const weeksPerPage = 3; // Number of weeks to show per page

    // Starting date based on the selected date
    let start = new Date(selectedDate);

    // End date to cover all pages
    const end = new Date(start);
    end.setDate(start.getDate() + weeksPerPage * 7 * numberOfPages);

    // Get all the weeks from the selected start date until the calculated end date
    const allWeeks = this.getCustomWeekArray(start, end);

    if (allWeeks.length === 0) {
      return <div>No data to display</div>;
    }

    // Time slots for the schedule
    const timeSlots = ["10:00 AM - 12:30 PM", "1:30 PM - 3:00 PM"];

    // Generate calendar IDs
    const calendarIds = Array.from({ length: numberOfPages }, (_, i) => `calendar-${i + 1}`);

    return (
      <div>
        <div className="header-container">
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
            <DatePicker
              label="Select Start Date"
              value={this.state.selectedDate}
              onChange={(newDate) => this.handleDateChange(newDate)}
              renderInput={(params) => (
                <TextField {...params} className="start-date-field" size="small" fullWidth />
              )}
            />
          </LocalizationProvider>
          <MDTypography className="title" fontSize="16px">
            {localizer.format(start, "DD/MM/yyyy")} - {localizer.format(end, "DD/MM/yyyy")}
          </MDTypography>
          <TextField
            className="pages-input"
            label="Pages"
            type="number"
            value={numberOfPages}
            onChange={(e) =>
              this.setState({ numberOfPages: Math.min(parseInt(e.target.value, 10) || 1, 5) })
            }
            inputProps={{ min: 1, max: 5 }}
            size="small"
            fullWidth
            error={numberOfPages < 1 || numberOfPages > 5}
            helperText={
              numberOfPages < 1
                ? "Number of pages can't be less than 1."
                : numberOfPages > 5
                ? "Number of pages can't be more than 5."
                : ""
            }
          />

          <IconButton
            className="export-button"
            onClick={this.openExportMenu}
            aria-label="Export options"
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={this.state.exportAnchorEl}
            open={Boolean(this.state.exportAnchorEl)}
            onClose={this.closeExportMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            <NotificationItem
              icon={
                <Icon>
                  <PrintIcon />
                </Icon>
              }
              title="Print"
              onClick={this.handlePrint}
            />
            <NotificationItem
              icon={
                <Icon>
                  <ImageIcon />
                </Icon>
              }
              title="Export PNG"
              onClick={this.exportPNG}
            />
            <NotificationItem
              icon={
                <Icon>
                  <PictureAsPdfIcon />
                </Icon>
              }
              title="Export PDF"
              onClick={this.exportPDF}
            />
          </Menu>
          {/* ReactToPrint instance (hidden trigger; we call it programmatically) */}
          <ReactToPrint
            ref={(el) => (this.reactToPrintRef = el)}
            trigger={() => <span style={{ display: "none" }} />}
            content={() => this.printRef.current}
          />
        </div>

        <ActorContext.Consumer>
          {({ selectedActor }) => (
            <div ref={this.exportRef} className="print-view-only">
              {calendarIds.map((calendarId, pageIndex) => {
                // Get the weeks for the current page (3 weeks per page)
                const startIdx = pageIndex * weeksPerPage;
                const endIdx = startIdx + weeksPerPage;
                const weeksToRender = allWeeks.slice(startIdx, endIdx);
                const displayName = selectedActor || "No Actor Selected";

                return (
                  <div key={calendarId} style={{ marginBottom: "12px" }}>
                    <div
                      className="header-section export-only"
                      style={{
                        display: "none",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "8px",
                      }}
                    >
                      <img src={logo} alt="Logo" className="logo" style={{ top: 0, left: 0 }} />
                      <div
                        className="actor-name"
                        style={{
                          flexGrow: 1,
                          textAlign: "center",
                          fontSize: "1.5rem",
                          fontWeight: "bold",
                        }}
                      >
                        {displayName}
                      </div>
                    </div>

                    <div className="print-calendar-wrapper">
                      <div
                        className={clsx("rbc-month-view", className, "print-view")}
                        role="table"
                        aria-label={`Month View ${pageIndex + 1}`}
                        ref={this.containerRef}
                      >
                        <div className="rbc-row rbc-month-header" role="row">
                          <div className="rbc-header time-header">Time</div>
                          {weeksToRender.length > 0 && this.renderHeaders(weeksToRender[0])}
                          <div className="rbc-header notes-header">Notes</div>
                        </div>

                        {weeksToRender.map((week, weekIdx) => (
                          <div key={weekIdx} className="rbc-month-row">
                            <div className="rbc-time-column">
                              <div className="rbc-time-column-header">Time</div>
                              {timeSlots.map((time, idx) => (
                                <div key={idx} className="rbc-time-cell">
                                  {time}
                                </div>
                              ))}
                            </div>

                            <div className="rbc-week-days">{this.renderWeek(week, weekIdx)}</div>

                            <div className="rbc-notes-column">
                              <div className="rbc-time-column-header">Individual Notes</div>
                              <div className="rbc-notes-cell">
                                {this.renderSingleNoteCell(weekIdx, calendarId)}
                              </div>
                            </div>
                          </div>
                        ))}
                        {this.props.popup && this.renderOverlay()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ActorContext.Consumer>

        <div style={{ display: "none" }}>
          <div ref={this.printRef}>{this.renderPrintContent()}</div>
        </div>
      </div>
    );
  }

  renderPrintContent() {
    const { className } = this.props;
    const { selectedDate, numberOfPages } = this.state;
    const notes = (this.context && this.context.notes) || {};

    const weeksPerPage = 3; // Number of weeks per page

    let start = new Date(selectedDate);
    const end = new Date(start);
    end.setDate(start.getDate() + weeksPerPage * 7 * numberOfPages);

    const allWeeks = this.getCustomWeekArray(start, end);

    if (allWeeks.length === 0) {
      return <div>No data to display</div>;
    }

    const timeSlots = ["10:00 AM - 12:30 PM", "1:30 PM - 3:00 PM"];

    return (
      <ActorContext.Consumer>
        {({ selectedActor }) => (
          <div className="main-cal-div print-view-only">
            {Array.from({ length: numberOfPages }, (_, pageIndex) => {
              const startIdx = pageIndex * weeksPerPage;
              const endIdx = startIdx + weeksPerPage;
              const weeksToRender = allWeeks.slice(startIdx, endIdx);

              return (
                <div key={pageIndex} className={`print-page page-${pageIndex}`}>
                  <div
                    className="header-section"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <img src={logo} alt="Logo" className="logo" style={{ top: 0, left: 0 }} />
                    <div
                      className="actor-name"
                      style={{
                        flexGrow: 1,
                        textAlign: "center",
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                      }}
                    >
                      {selectedActor || "No Actor Selected"}
                    </div>
                  </div>

                  <div className="print-calendar-wrapper">
                    <div
                      className={clsx(
                        "rbc-month-view",
                        className,
                        "print-view",
                        "pre-print-calendar"
                      )}
                      role="table"
                      aria-label="Month View"
                    >
                      <div className="rbc-row rbc-month-header" role="row">
                        <div className="rbc-header time-header">Time</div>
                        {weeksToRender.length > 0 && this.renderHeaders(weeksToRender[0])}
                        <div className="rbc-header notes-header">Notes</div>
                      </div>

                      {weeksToRender.map((week, weekIdx) => {
                        // Note key should match the format stored in state
                        const calendarIndex = pageIndex + 1; // Adjust calendarIndex based on pageIndex
                        const noteKey = `calendar-${calendarIndex}-${weekIdx}`;

                        return (
                          <div key={weekIdx} className="rbc-month-row">
                            <div className="rbc-time-column">
                              <div className="rbc-time-column-header">Time</div>
                              {timeSlots.map((time, idx) => (
                                <div key={idx} className="rbc-time-cell">
                                  {time}
                                </div>
                              ))}
                            </div>

                            <div className="rbc-week-days">{this.renderWeek(week, weekIdx)}</div>

                            <div className="rbc-notes-column">
                              <div className="rbc-time-column-header">Individual Notes</div>
                              <div className="rbc-notes-cell">
                                <MDTypography p={1} variant="body2" fontWeight="medium">
                                  {notes[noteKey] || ""}
                                </MDTypography>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ActorContext.Consumer>
    );
  }

  renderWeek = (week, weekIdx) => {
    const {
      events,
      components,
      selectable,
      getNow,
      selected,
      date,
      localizer,
      longPressThreshold,
      accessors,
      getters,
      showAllEvents,
    } = this.props;

    const { needLimitMeasure, rowLimit } = this.state;

    // Filter out Saturdays and Sundays
    week = week.filter((day) => day.getDay() !== 0 && day.getDay() !== 6);

    const startOfWeek = week[0];
    const endOfWeek = week[week.length - 1];

    const weeksEvents = eventsForWeek([...events], startOfWeek, endOfWeek, accessors, localizer);
    console.log("Week Events", weeksEvents);
    const sorted = sortWeekEvents(weeksEvents, accessors, localizer);

    return (
      <DateContentRow
        key={weekIdx}
        ref={weekIdx === 0 ? this.slotRowRef : undefined}
        container={this.getContainer}
        className="rbc-month-row"
        getNow={getNow}
        date={date}
        range={week}
        events={sorted}
        maxRows={showAllEvents ? Infinity : rowLimit}
        selected={selected}
        selectable={selectable}
        components={components}
        accessors={accessors}
        getters={getters}
        localizer={localizer}
        renderHeader={this.readerDateHeading}
        renderForMeasure={needLimitMeasure}
        onShowMore={this.handleShowMore}
        onSelect={this.handleSelectEvent}
        onDoubleClick={this.handleDoubleClickEvent}
        onKeyPress={this.handleKeyPressEvent}
        onSelectSlot={this.handleSelectSlot}
        longPressThreshold={longPressThreshold}
        rtl={this.props.rtl}
        resizable={this.props.resizable}
        showAllEvents={showAllEvents}
      />
    );
  };

  readerDateHeading = ({ date, className, ...props }) => {
    const { date: currentDate, getDrilldownView, localizer } = this.props;
    const isOffRange = localizer.neq(date, currentDate, "month");
    const isCurrent = localizer.isSameDate(date, currentDate);
    const drilldownView = getDrilldownView(date);

    // Get the correct month name and day number
    const monthName = localizer.format(date, "MMM"); // shortened month for mobile
    const dayNumber = date.getDate(); // Correct day number

    // Combine month name and correct day number
    const label = `${monthName} ${dayNumber}`;

    const DateHeaderComponent = this.props.components.dateHeader || DateHeader;

    return (
      <div
        {...props}
        className={clsx(className, isOffRange && "rbc-off-range", isCurrent && "rbc-current")}
        role="cell"
      >
        <DateHeaderComponent
          label={label}
          date={date}
          drilldownView={drilldownView}
          isOffRange={isOffRange}
          onDrillDown={(e) => this.handleHeadingClick(date, drilldownView, e)}
        />
      </div>
    );
  };

  renderHeaders = (row) => {
    let { localizer, components } = this.props;

    // Filter out weekends (if applicable)
    row = row.filter((day) => day.getDay() !== 0 && day.getDay() !== 6);

    let HeaderComponent = components.header || Header;

    return (
      <>
        {row.map((day, idx) => (
          <div key={"header_" + idx} className="rbc-header">
            <HeaderComponent
              date={day}
              localizer={localizer}
              label={localizer.format(day, "weekdayFormat")}
            />
          </div>
        ))}
      </>
    );
  };

  renderOverlay() {
    let overlay = this.state?.overlay ?? {};
    let { accessors, localizer, components, getters, selected, popupOffset, handleDragStart } =
      this.props;

    const onHide = () => this.setState({ overlay: null });

    return (
      <PopOverlay
        overlay={overlay}
        accessors={accessors}
        localizer={localizer}
        components={components}
        getters={getters}
        selected={selected}
        popupOffset={popupOffset}
        ref={this.containerRef}
        handleKeyPressEvent={this.handleKeyPressEvent}
        handleSelectEvent={this.handleSelectEvent}
        handleDoubleClickEvent={this.handleDoubleClickEvent}
        handleDragStart={handleDragStart}
        show={!!overlay.position}
        overlayDisplay={this.overlayDisplay}
        onHide={onHide}
      />
    );
  }

  measureRowLimit() {
    this.setState({
      needLimitMeasure: false,
      rowLimit: this.slotRowRef.current.getRowLimit(),
    });
  }

  handleSelectSlot = (range, slotInfo) => {
    this._pendingSelection = this._pendingSelection.concat(range);

    clearTimeout(this._selectTimer);
    this._selectTimer = setTimeout(() => this.selectDates(slotInfo));
  };

  handleHeadingClick = (date, view, e) => {
    e.preventDefault();
    this.clearSelection();
    notify(this.props.onDrillDown, [date, view]);
  };

  handleSelectEvent = (...args) => {
    this.clearSelection();
    notify(this.props.onSelectEvent, args);
  };

  handleDoubleClickEvent = (...args) => {
    this.clearSelection();
    notify(this.props.onDoubleClickEvent, args);
  };

  handleKeyPressEvent = (...args) => {
    this.clearSelection();
    notify(this.props.onKeyPressEvent, args);
  };

  handleShowMore = (events, date, cell, slot, target) => {
    const { popup, onDrillDown, onShowMore, getDrilldownView, doShowMoreDrillDown } = this.props;

    this.clearSelection();

    if (popup) {
      let position = getPosition(cell, this.containerRef.current);

      this.setState({
        overlay: { date, events, position, target },
      });
    } else if (doShowMoreDrillDown) {
      notify(onDrillDown, [date, getDrilldownView(date) || views.DAY]);
    }

    notify(onShowMore, [events, date, slot]);
  };

  overlayDisplay = () => {
    this.setState({
      overlay: null,
    });
  };

  selectDates(slotInfo) {
    let slots = this._pendingSelection.slice();

    this._pendingSelection = [];

    slots.sort((a, b) => +a - +b);

    const start = new Date(slots[0]);
    const end = new Date(slots[slots.length - 1]);
    end.setDate(slots[slots.length - 1].getDate() + 1);

    notify(this.props.onSelectSlot, {
      slots,
      start,
      end,
      action: slotInfo.action,
      bounds: slotInfo.bounds,
      box: slotInfo.box,
    });
  }

  clearSelection() {
    clearTimeout(this._selectTimer);
    this._pendingSelection = [];
  }
}

CustomPrintView.propTypes = {
  events: PropTypes.array.isRequired,
  date: PropTypes.instanceOf(Date),
  min: PropTypes.instanceOf(Date),
  max: PropTypes.instanceOf(Date),
  step: PropTypes.number,
  getNow: PropTypes.func.isRequired,
  scrollToTime: PropTypes.instanceOf(Date),
  enableAutoScroll: PropTypes.bool,
  rtl: PropTypes.bool,
  resizable: PropTypes.bool,
  width: PropTypes.number,
  accessors: PropTypes.object.isRequired,
  components: PropTypes.object.isRequired,
  getters: PropTypes.object.isRequired,
  localizer: PropTypes.object.isRequired,
  selected: PropTypes.object,
  selectable: PropTypes.oneOf([true, false, "ignoreEvents"]),
  longPressThreshold: PropTypes.number,
  onSelectSlot: PropTypes.func,
  onSelectEvent: PropTypes.func,
  onDoubleClickEvent: PropTypes.func,
  onKeyPressEvent: PropTypes.func,
  onShowMore: PropTypes.func,
  showAllEvents: PropTypes.bool,
  doShowMoreDrillDown: PropTypes.bool,
  onDrillDown: PropTypes.func,
  getDrilldownView: PropTypes.func.isRequired,
  popup: PropTypes.bool,
  handleDragStart: PropTypes.func,
  popupOffset: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
    }),
  ]),
};

CustomPrintView.range = (date, { localizer }) => {
  const start = localizer.firstVisibleDay(date, localizer);
  const end = localizer.lastVisibleDay(date, localizer);
  return [start, end]; // Return as an array
};

CustomPrintView.navigate = (date, action, { localizer }) => {
  switch (action) {
    case navigate.PREVIOUS:
      return localizer.add(date, -1, "month");
    case navigate.NEXT:
      return localizer.add(date, 1, "month");
    default:
      return date;
  }
};

CustomPrintView.title = (date, { localizer }) => {};

export default CustomPrintView;
