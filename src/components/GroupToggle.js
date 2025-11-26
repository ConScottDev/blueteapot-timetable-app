import React, { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Select, { components } from "react-select";
import { useActor } from "context/ActorProvider"; // Import useActor hook

const GroupToggle = ({
  participants,
  selectedParticipants,
  onParticipantsChange,
  isMulti,
  compact = false,
}) => {
  const { selectedActor, setSelectedActor } = useActor(); // Destructure selectedActor and setSelectedActor from context

  // Create options from participants
  const options = useMemo(
    () =>
      participants.map((participant) => ({
        value: participant.id,
        label: `${participant.name}`,
      })),
    [participants]
  );

  const selectValue = useMemo(() => {
    if (isMulti) {
      return options.filter((option) => selectedParticipants.includes(option.value));
    }
    const selectedValue = selectedParticipants[0];
    return options.find((option) => option.value === selectedValue) || null;
  }, [isMulti, options, selectedParticipants]);

  const handleChange = (selectedOptions) => {
    if (isMulti) {
      const selectedValues = selectedOptions ? selectedOptions.map((option) => option.value) : [];
      onParticipantsChange(selectedValues); // Update selectedParticipants for month view
    } else {
      // When in single actor mode, we only need to select one actor
      const selectedValue = selectedOptions ? selectedOptions.value : null;
      onParticipantsChange(selectedValue ? [selectedValue] : []); // Update selectedParticipants with one actor
      setSelectedActor(selectedValue ? selectedOptions.label : ""); // Update selectedActor in context
    }
  };

  // Sync selected actor when switching to custom views
  useEffect(() => {
    if (!isMulti) {
      if (selectedParticipants.length > 0) {
        // Ensure the first actor from selectedParticipants is shown when in custom view
        const firstActor = selectedParticipants[0];
        setSelectedActor(participants.find((p) => p.id === firstActor)?.name || "");
      } else {
        setSelectedActor("");
      }
    }
  }, [isMulti, selectedParticipants, setSelectedActor, participants]);

  // Custom styles for the Select component
  const customStyles = useMemo(
    () => ({
      control: (provided) => ({
        ...provided,
        width: compact ? "100%" : "350px",
        minHeight: "40px",
        fontSize: "1rem",
      }),
      valueContainer: (provided) => ({
        ...provided,
        padding: "0 8px",
        fontSize: "1rem",
      }),
      indicatorsContainer: (provided) => ({
        ...provided,
        height: "40px",
      }),
      option: (provided) => ({
        ...provided,
        fontSize: "1rem",
      }),
      menu: (provided) => ({
        ...provided,
        fontSize: "0.75rem",
        zIndex: 1300, // Ensure this is higher than other elements
      }),
    }),
    [compact]
  );

  return (
    <Select
      options={options}
      isMulti={isMulti}
      value={selectValue}
      onChange={handleChange}
      closeMenuOnSelect={!isMulti}
      hideSelectedOptions={false}
      styles={customStyles}
      components={{
        Option: (props) => (
          <div>
            <components.Option {...props}>
              {isMulti && (
                <input type="checkbox" checked={props.isSelected} onChange={() => null} />
              )}{" "}
              <label>{props.label}</label>
            </components.Option>
          </div>
        ),
      }}
      placeholder="Select participants..."
    />
  );
};

GroupToggle.propTypes = {
  participants: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      type: PropTypes.oneOf(["actor", "student", "group"]).isRequired,
    })
  ).isRequired,
  selectedParticipants: PropTypes.arrayOf(PropTypes.string).isRequired,
  onParticipantsChange: PropTypes.func.isRequired,
  isMulti: PropTypes.bool.isRequired,
  compact: PropTypes.bool,
};

export default GroupToggle;
