package models

// ParkingSlot represents a single parking slot's data.
// It is used for both MongoDB persistence and Redis caching.
type ParkingSlot struct {
	SlotID   string  `json:"slot_id" bson:"slot_id" binding:"required"`
	Status   string  `json:"status" bson:"status" binding:"required"` // e.g., "Available", "Occupied", "Reserved"
	Level    string  `json:"level" bson:"level" binding:"required"`
	Location float64 `json:"location" bson:"location"` 
}