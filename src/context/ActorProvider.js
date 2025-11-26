import { createContext, useContext, useState } from "react";

export const ActorContext = createContext();

export const ActorProvider = ({ children }) => {
  const [selectedActor, setSelectedActor] = useState(null);

  return (
    <ActorContext.Provider value={{ selectedActor, setSelectedActor }}>
      {children}
    </ActorContext.Provider>
  );
};

export const useActor = () => {
  return useContext(ActorContext);
};
