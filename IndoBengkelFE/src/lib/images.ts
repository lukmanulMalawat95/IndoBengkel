const unsplash = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;

export const workshopImages = [
  unsplash("photo-1487754180451-c456f719a1fc"),
  unsplash("photo-1486262715619-67b85e0b08d3"),
  unsplash("photo-1503376780353-7e6692767b70"),
  unsplash("photo-1558981806-ec527fa84c39"),
  unsplash("photo-1581092160607-ee22621dd758"),
  unsplash("photo-1517524008697-84bbe3c3fd98"),
];

export const productImages = [
  unsplash("photo-1607860108855-64acf2078ed9", 800),
  unsplash("photo-1578844251758-2f71da64c96f", 800),
  unsplash("photo-1558981806-ec527fa84c39", 800),
  unsplash("photo-1486262715619-67b85e0b08d3", 800),
  unsplash("photo-1517524008697-84bbe3c3fd98", 800),
];

export const avatarImages = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
];
