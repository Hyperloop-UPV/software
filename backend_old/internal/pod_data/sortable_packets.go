package pod_data

import "sort"

type SortablePacket []Packet

func (packets SortablePacket) Len() int {
	return len(packets)
}

func (packets SortablePacket) Less(i, j int) bool {
	return int(packets[i].Id) < int(packets[j].Id)
}

func (packets SortablePacket) Swap(i, j int) {
	packets[i], packets[j] = packets[j], packets[i]
}

func sortPackets(packets []Packet) []Packet {
	sortablePackets := SortablePacket(packets)
	sort.Sort(sortablePackets)
	return sortablePackets
}
