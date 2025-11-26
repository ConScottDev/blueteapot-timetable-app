import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "utils/firebase"; // Update with your actual path

function fetchActors() {
  const [actors, setActors] = useState([]);

  useEffect(() => {
    const getActors = async () => {
      const querySnapshot = await getDocs(collection(db, "actors"));
      const actorsList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setActors(actorsList);
    };

    getActors();
  }, []);

  return actors;
}
