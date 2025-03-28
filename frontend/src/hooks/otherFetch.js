import { useState, useEffect } from "react";
import axios from "axios";

export const otherFetch = (link, interval = 2000) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true; // To avoid state updates if unmounted

        const fetchData = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_API}${link}`);
                if (isMounted) {
                    setData(res.data);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) setError(err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData(); // Initial Fetch

        const intervalId = setInterval(fetchData, interval); // Fetch every X ms

        return () => {
            isMounted = false;
            clearInterval(intervalId); // Cleanup on unmount
        };
    }, [link, interval]); // Refetch if link or interval changes

    return { data, error, loading };
};
