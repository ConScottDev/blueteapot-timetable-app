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
import "../assets/productionCalendar.css";
import { Icon, IconButton, TextField, Menu } from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ImageIcon from "@mui/icons-material/Image";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import MDTypography from "./MDTypography";
import NotificationItem from "examples/Items/NotificationItem";
import logo from "../assets/images/blue-teapot-logo-png-01.png"; // Adjust path as needed
import { de, enGB, zhCN } from "date-fns/locale"; // Utility functions
import { ActorContext } from "context/ActorProvider";

const eventsForWeek = (evts, start, end, accessors, localizer) =>
  evts.filter((e) => inRange(e, start, end, accessors, localizer));

class ProductionCalendar extends React.Component {
  static contextType = ActorContext;

  constructor(...args) {
    super(...args);

    this.state = {
      rowLimit: 5,
      needLimitMeasure: true,
      date: null,
      selectedDate: new Date(), // New state for selected date
      overlay: null,
      exportAnchorEl: null,
    };
    this.containerRef = createRef();
    this.slotRowRef = createRef();
    this.printRef = createRef(); // Reference for the print component
    this.exportRef = createRef(); // Visible export target
    this.reactToPrintRef = null; // ReactToPrint handler reference
    this._bgRows = [];
    this._pendingSelection = [];
  }

  openExportMenu = (event) => this.setState({ exportAnchorEl: event.currentTarget });

  closeExportMenu = () => this.setState({ exportAnchorEl: null });

  handlePrint = () => {
    this.closeExportMenu();
    if (this.reactToPrintRef?.handlePrint) {
      this.reactToPrintRef.handlePrint();
    }
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
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "schedule.png";
    link.click();
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
    const banner = documentClone.querySelector(".prod-cal-export-banner");
    if (banner) {
      banner.style.display = "flex";
    }
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

  getContainer = () => this.containerRef.current;

  render() {
    let { date, localizer, className } = this.props,
      month = localizer.visibleDays(date, localizer),
      weeks = chunk(month, 7);

    this._weekCount = weeks.length;
    const actorName = this.context?.selectedActor || "";

    return (
      <div>
        <div ref={this.exportRef}>
          <div
            className="prod-cal-export-banner"
            style={{
              display: "none",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            <img
              src={logo}
              alt="Logo"
              className="logo"
              style={{ width: "120px", height: "auto" }}
            />
            {actorName && (
              <MDTypography style={{ fontSize: "20px", fontWeight: 600 }}>{actorName}</MDTypography>
            )}
          </div>
          <div className="header-container">
            <LocalizationProvider
              dateAdapter={AdapterDateFns}
              adapterLocale={enGB}
            ></LocalizationProvider>
            <IconButton onClick={this.openExportMenu} aria-label="Export options">
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
            <ReactToPrint
              ref={(el) => (this.reactToPrintRef = el)}
              trigger={() => <span style={{ display: "none" }} />}
              content={() => this.printRef.current}
            />
          </div>
          <div
            className={clsx("rbc-month-view", className, "print-view prod-cal")}
            role="table"
            aria-label="Month View"
            ref={this.containerRef}
          >
            <div className="rbc-row rbc-month-header" role="row">
              {this.renderHeaders(weeks[0])}
            </div>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="rbc-month-row">
                <div className="rbc-week-days">{this.renderWeek(week, weekIdx)}</div>
              </div>
            ))}
            {this.props.popup && this.renderOverlay()}
          </div>
        </div>
        <div style={{ display: "none" }}>
          <div ref={this.printRef}>{this.renderPrintContent()}</div>
        </div>
      </div>
    );
  }

  renderPrintContent() {
    let { date, localizer, className } = this.props,
      month = localizer.visibleDays(date, localizer),
      weeks = chunk(month, 7);

    this._weekCount = weeks.length;
    const actorName = this.context?.selectedActor || "";

    return (
      <div className="prod-cal">
        <div
          className="prod-cal-export-banner"
          style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}
        >
          <img src={logo} alt="Logo" className="logo" />
          {actorName && (
            <MDTypography style={{ fontSize: "20px", fontWeight: 600 }}>{actorName}</MDTypography>
          )}
        </div>
        <div
          className={clsx("rbc-month-view", className, "print-view", "pre-print-calendar")}
          role="table"
          aria-label="Month View"
        >
          <div className="rbc-row rbc-month-header" role="row">
            {this.renderHeaders(weeks[0])}
          </div>

          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="rbc-month-row">
              <div className="rbc-week-days">{this.renderWeek(week, weekIdx)}</div>
            </div>
          ))}
        </div>
      </div>
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

    const startOfWeek = week[0];
    const endOfWeek = week[week.length - 1];

    const weeksEvents = eventsForWeek([...events], startOfWeek, endOfWeek, accessors, localizer);
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
    const monthName = localizer.format(date, "MMMM"); // "August"
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

    // Filter out weekends (if applicable)\s
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

ProductionCalendar.propTypes = {
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

ProductionCalendar.range = (date, { localizer }) => {
  const start = localizer.firstVisibleDay(date, localizer);
  const end = localizer.lastVisibleDay(date, localizer);
  return [start, end]; // Return as an array
};

ProductionCalendar.navigate = (date, action, { localizer }) => {
  switch (action) {
    case navigate.PREVIOUS:
      return localizer.add(date, -1, "month");
    case navigate.NEXT:
      return localizer.add(date, 1, "month");
    default:
      return date;
  }
};

ProductionCalendar.title = (date, { localizer }) => localizer.format(date, "monthHeaderFormat");

export default ProductionCalendar;
