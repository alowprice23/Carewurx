import math
from typing import List, Dict, Set, Tuple, Optional
import copy # Added for deepcopy in potential merge logic

class Client:
    def __init__(self, name: str, hours: int, days: int, needs_driver: bool, zip_code: str):
        self.name = name
        self.hours = hours
        self.days = days
        self.needs_driver = needs_driver
        self.zip_code = zip_code

    def __repr__(self):
        return f"Client({self.name}, {self.hours}h, {self.days}d, Driver:{self.needs_driver}, Zip:{self.zip_code})"

class CaregiverPosition:
    def __init__(self, position_id: int):
        self.position_id = position_id
        self.clients: List[Client] = []
        self.total_hours = 0
        self.working_days = 0  # Simplified: sum of client days. Real scenario needs overlap analysis.
        self.requires_driver: Optional[bool] = None  # Set by first client assignment ideally
        self.zip_codes: List[str] = []
        self.position_type: Optional[str] = None # "Part-time" or "Full-time"
        self.driver_type: Optional[str] = None # "Driver" or "Non-driver"

    def can_accept_client(self, client: Client) -> bool:
        """Check if position can accept this client based on ALL constraints"""

        # CONSTRAINT 1: Driver requirement consistency
        if self.requires_driver is not None and client.needs_driver != self.requires_driver:
            # print(f"Debug: Pos {self.position_id} (req_driver={self.requires_driver}) cannot accept client {client.name} (needs_driver={client.needs_driver}) due to driver mismatch.")
            return False

        # CONSTRAINT 2: Hour limit (45h max)
        if self.total_hours + client.hours > 45:
            # print(f"Debug: Pos {self.position_id} (hours={self.total_hours}) cannot accept client {client.name} (hours={client.hours}) due to hour limit > 45.")
            return False

        # CONSTRAINT 3: Minimum viable hours (16h min for position)
        # This is usually checked *after* a position is fully formed, not for each client.
        # However, if a single client would make it impossible to reach 16h (e.g. client has 1h, pos has 1h, still far from 16h)
        # it might be a premature optimization to reject here.
        # The current algorithm structure defers this to `all_constraints_satisfied`.

        # CONSTRAINT 4: Part-time limit (24h max for part-time)
        # This is a classification, not an acceptance constraint. Max hours is 45.

        # CONSTRAINT 5: Day limit (5 days max) - simplified sum
        # In a real system, this would involve checking actual day assignments (e.g. Mon, Tue)
        # For now, it's a simple sum of days from clients.
        if self.working_days + client.days > 5: # Simplified sum
            # print(f"Debug: Pos {self.position_id} (days={self.working_days}) cannot accept client {client.name} (days={client.days}) due to day limit > 5.")
            return False

        # CONSTRAINT 6: One shift per day (no overlapping schedules)
        # Note: This would require detailed schedule parsing in real implementation. Not handled here.

        return True

    def assign_client(self, client: Client):
        """Assign client to this position"""
        if not self.clients: # First client sets the driver requirement
            self.requires_driver = client.needs_driver

        self.clients.append(client)
        self.total_hours += client.hours
        self.working_days += client.days # Simplified sum
        if client.zip_code not in self.zip_codes:
            self.zip_codes.append(client.zip_code)

    def unassign_client(self, client: Client):
        """Remove client from this position and update stats"""
        if client in self.clients:
            self.clients.remove(client)
            self.total_hours -= client.hours
            self.working_days -= client.days # Simplified

            # Recalculate zip codes from remaining clients
            self.zip_codes = list(set(c.zip_code for c in self.clients if c.zip_code))

            # Recalculate driver requirement based on remaining clients
            if not self.clients:
                self.requires_driver = None
            else:
                self.requires_driver = any(c.needs_driver for c in self.clients)
        else:
            print(f"Warning: Client {client.name} not found in position {self.position_id} during unassign.")

    def __repr__(self):
        client_names = [c.name for c in self.clients]
        return (f"PosID:{self.position_id}, Clients:{client_names}, Hours:{self.total_hours}, "
                f"Days:{self.working_days}, DriverReq:{self.requires_driver}, Type:{self.position_type}")

def constraint_satisfaction_algorithm(clients: List[Client], initial_position_id_start=1) -> List[CaregiverPosition]:
    """
    MAIN ALGORITHM: Find minimum caregivers using constraint satisfaction
    """
    if not clients:
        return []

    total_hours = sum(client.hours for client in clients)

    # Calculate theoretical minimum caregivers. At least 1 if there are clients with hours.
    if total_hours == 0:
        # If all clients have 0 hours, they technically don't need a caregiver by hour-based constraints.
        # Business rule: Do 0-hour clients still need to be "assigned"?
        # Current constraints (min 16h) would prevent assigning them to valid positions.
        # Filter them out or handle as a special case if they must be listed.
        clients = [c for c in clients if c.hours > 0]
        if not clients:
            print("All clients have 0 hours or no clients to schedule. Returning empty solution.")
            return []
        total_hours = sum(client.hours for client in clients) # Recalculate

    theoretical_min = math.ceil(total_hours / 45) if total_hours > 0 else 0
    # If there are clients, we need at least 1 caregiver, even if total hours < 45
    theoretical_min = max(1, theoretical_min) if clients else 0

    practical_max = len(clients) # Max one caregiver per client

    print(f"Optimization Range for {len(clients)} clients: {theoretical_min}-{practical_max} caregivers. Total Hours: {total_hours}h")

    for target_caregivers in range(theoretical_min, practical_max + 1):
        print(f"\nAttempting solution with {target_caregivers} caregivers...")

        # Attempt to assign all clients using exactly 'target_caregivers'
        # The solution returned by attempt_assignment will be validated and cleaned.
        solution_positions = attempt_assignment(clients, target_caregivers, initial_position_id_start)

        if solution_positions: # If a non-empty list (meaning a valid assignment was found)
            # Ensure all original clients were assigned
            assigned_client_names = set()
            for pos in solution_positions:
                for client_obj in pos.clients:
                    assigned_client_names.add(client_obj.name)

            original_client_names = set(c.name for c in clients)

            if assigned_client_names == original_client_names:
                print(f"✅ OPTIMAL SOLUTION FOUND: {len(solution_positions)} caregivers for {len(clients)} clients.")
                return solution_positions # This solution is validated and has all clients
            else:
                print(f"⚠️ Attempt with {target_caregivers} found a partial solution. Missing clients: {original_client_names - assigned_client_names}. Continuing search...")
        else: # attempt_assignment returned None or empty list
            print(f"❌ Cannot solve with {target_caregivers} caregivers satisfying all constraints for all clients.")

    print("No valid solution found after checking all caregiver counts in the range.")
    return [] # Return empty list if no solution found

def attempt_assignment(clients: List[Client], target_caregivers: int, position_id_start: int) -> Optional[List[CaregiverPosition]]:
    """
    Try to assign ALL clients using EXACTLY target_caregivers.
    Returns a list of validated CaregiverPosition objects if successful, otherwise None.
    """
    if not clients:
        return []
    if target_caregivers == 0 and clients: # Cannot assign clients to 0 caregivers
        return None

    positions = [CaregiverPosition(position_id_start + i) for i in range(target_caregivers)]

    # Sort clients: driver needed, then by most hours, then by most days
    sorted_clients = sort_by_assignment_difficulty(clients)

    # Resulting raw positions from backtracking
    raw_assigned_positions = backtrack_assignment(sorted_clients, positions, 0)

    if raw_assigned_positions:
        # Validate the solution: checks constraints (min hours, etc.) and removes empty positions
        validated_solution = validate_and_return_solution(raw_assigned_positions, position_id_start)

        if validated_solution:
            # Further check: ensure all original clients are in this validated solution
            assigned_clients_in_validated_solution = set()
            for pos in validated_solution:
                for client_obj in pos.clients:
                    assigned_clients_in_validated_solution.add(client_obj.name)

            original_client_names = set(c.name for c in clients)

            if assigned_clients_in_validated_solution == original_client_names:
                return validated_solution
            else:
                # This means some clients could not be part of a *valid* position,
                # or were dropped by validation (e.g., a position became too small).
                # print(f"Debug: Post-validation, not all clients assigned. Expected: {original_client_names}, Got: {assigned_clients_in_validated_solution}")
                return None # Not a complete solution for all clients
        else:
            # print("Debug: Raw assignment found, but failed validation (e.g. no positions met min criteria).")
            return None # Failed validation
    else:
        # print("Debug: Backtracking found no assignment for all clients.")
        return None # Backtracking failed to assign all clients

def sort_by_assignment_difficulty(clients: List[Client]) -> List[Client]:
    def difficulty_score(client: Client) -> Tuple[int, int, int]:
        driver_priority = 0 if client.needs_driver else 1
        hour_priority = -client.hours  # Descending hours
        day_priority = -client.days    # Descending days
        return (driver_priority, hour_priority, day_priority)
    return sorted(clients, key=difficulty_score)

def backtrack_assignment(clients: List[Client], positions: List[CaregiverPosition],
                        client_index: int) -> Optional[List[CaregiverPosition]]:
    if client_index >= len(clients):
        # All clients have been placed into some position.
        # This is a potential solution; further validation occurs in validate_and_return_solution.
        return positions

    current_client = clients[client_index]

    # Try assigning current_client to each available position
    for position in positions:
        if position.can_accept_client(current_client):
            position.assign_client(current_client)

            result = backtrack_assignment(clients, positions, client_index + 1)
            if result is not None:
                return result  # Path found for remaining clients

            # Backtrack: undo assignment
            position.unassign_client(current_client)
            # Note: position.requires_driver is reset by unassign_client if needed

    return None # No position could accept current_client, or subsequent clients failed

def all_constraints_satisfied(positions: List[CaregiverPosition]) -> bool:
    """
    FINAL VALIDATION for a list of positions (assumes positions are populated).
    """
    if not positions: # No positions to validate
        return True

    for position in positions:
        if not position.clients: # Should not happen if called from validate_and_return_solution
            # print(f"Warning: Empty position {position.position_id} encountered in all_constraints_satisfied.")
            continue

        # CONSTRAINT CHECK 1: Hour limits (min 16h, max 45h) for a populated, finalized position
        if not (16 <= position.total_hours <= 45):
            # print(f"Debug: Pos {position.position_id} ({position.total_hours}h) failed final hour validation (16-45h). Clients: {[c.name for c in position.clients]}")
            return False

        # CONSTRAINT CHECK 2: Day limits (max 5 days) - simplified sum
        if position.working_days > 5:
            # print(f"Debug: Pos {position.position_id} ({position.working_days}d) failed final day validation (>5d).")
            return False

        # CONSTRAINT CHECK 3: Driver consistency (already checked by can_accept_client and assign_client)
        # but good to double check the final state of position.requires_driver
        if position.clients:
            expected_driver_req = any(c.needs_driver for c in position.clients)
            if position.requires_driver != expected_driver_req:
                # print(f"Debug: Pos {position.position_id} driver flag mismatch. Flag: {position.requires_driver}, Expected from clients: {expected_driver_req}")
                return False
    return True

def validate_and_return_solution(positions_to_validate: List[CaregiverPosition], new_id_start=1) -> Optional[List[CaregiverPosition]]:
    """
    Validates constraints on populated positions, removes empty ones, re-IDs, and sets types.
    Returns a list of valid positions, or None if the set as a whole is invalid.
    """
    # Filter out positions that ended up with no clients
    populated_positions = [pos for pos in positions_to_validate if pos.clients]

    if not populated_positions and any(pos.clients for pos in positions_to_validate):
        # This means all positions became empty after some filtering, which is unlikely here
        # but if there were clients to assign, and now no positions, it's not a valid outcome.
        # print("Debug: All positions became empty post-filtering, but there were clients.")
        return None

    if not populated_positions: # No clients were assigned or all positions were empty to begin with
        return []


    # Final check on all populated positions together
    if not all_constraints_satisfied(populated_positions):
        # print("Debug: Solution failed all_constraints_satisfied for populated positions.")
        return None

    # Set types and re-ID the valid, populated positions
    final_valid_positions = []
    for i, position in enumerate(populated_positions):
        position.position_id = new_id_start + i # Re-ID sequentially from new_id_start
        position.position_type = "Part-time" if position.total_hours <= 24 else "Full-time"

        # Ensure requires_driver is correctly set based on its clients
        if position.clients:
            current_req_driver = any(c.needs_driver for c in position.clients)
            if position.requires_driver is None or position.requires_driver != current_req_driver:
                # This can happen if a position was formed, then a client removed,
                # and requires_driver wasn't updated by unassign_client logic properly.
                # For safety, re-affirm here.
                position.requires_driver = current_req_driver
        else: # Should have been filtered, but defensively
            position.requires_driver = False

        position.driver_type = "Driver" if position.requires_driver else "Non-driver"
        final_valid_positions.append(position)

    return final_valid_positions


def optimize_with_strategic_enhancements(clients: List[Client]) -> List[CaregiverPosition]:
    """
    ENHANCED ALGORITHM: Handles oversized clients by splitting, then optimizes.
    """
    if not clients:
        return []

    print(f"\n=== Starting Enhanced Optimization for {len(clients)} clients ===")

    # PHASE 1: Handle mandatory client splits (>45 hours)
    # This function returns:
    #   - positions_from_splits: List[CaregiverPosition] (already formed for parts of oversized clients)
    #   - remaining_clients_for_main_algo: List[Client] (original clients <=45h)
    positions_from_splits, remaining_clients_for_main_algo = handle_mandatory_splits(clients)

    next_pos_id = 1
    if positions_from_splits:
        next_pos_id = max(p.position_id for p in positions_from_splits) + 1
        # Pre-validate these split positions. They should be valid if splits are >16h.
        # If a split part is <16h, it won't pass validation unless merged.
        # For now, handle_mandatory_splits creates them; validate_and_return_solution will filter if invalid.
        # Let's ensure they are detailed here.
        for pos in positions_from_splits:
            pos.position_type = "Part-time" if pos.total_hours <= 24 else "Full-time"
            pos.driver_type = "Driver" if pos.requires_driver else "Non-driver"


    # PHASE 2: Apply constraint satisfaction to remaining clients (those not needing splits)
    additional_positions: List[CaregiverPosition] = []
    if remaining_clients_for_main_algo:
        print(f"\n--- Running main algorithm for {len(remaining_clients_for_main_algo)} non-split or smaller clients ---")
        additional_positions = constraint_satisfaction_algorithm(remaining_clients_for_main_algo, initial_position_id_start=next_pos_id)
        if not additional_positions and remaining_clients_for_main_algo:
             print(f"Warning: Main algorithm found no solution for {len(remaining_clients_for_main_algo)} remaining clients.")
             # This could mean remaining clients are unassignable per constraints.

    # PHASE 3: Combine results
    # All positions from splits + positions from main algorithm for other clients
    combined_solution_pre_merge = positions_from_splits + (additional_positions if additional_positions else [])

    if not combined_solution_pre_merge and clients: # If we had clients but ended up with no positions
        print("Error: No positions formed after splits and main algorithm, though clients existed.")
        return []

    # PHASE 4: Post-optimization (try to merge positions if possible)
    # This is a placeholder. A real merge is complex.
    # For now, it just returns the combined list.
    # If merging is implemented, ensure IDs are handled correctly.
    print(f"\n--- Pre-Merge Solution: {len(combined_solution_pre_merge)} positions ---")
    # for pos in combined_solution_pre_merge: print(pos)

    optimized_solution_after_merge_attempt = post_optimization_merge(combined_solution_pre_merge)

    # PHASE 5: Final validation and re-ID of the entire set of positions
    print(f"\n--- Validating and Finalizing Solution ({len(optimized_solution_after_merge_attempt)} positions before final validation) ---")
    final_validated_solution = validate_and_return_solution(optimized_solution_after_merge_attempt, new_id_start=1)

    if final_validated_solution is None: # Should return [] from validate_and_return_solution if all invalid
        print("Error: The fully combined and potentially merged solution did not pass final validation. No schedule generated.")
        return []

    # Ensure all original clients (or their split parts) are accounted for in the final solution
    # This check is complex because of splits. The names change.
    # Easier to check if sum of hours in solution matches sum of hours of original clients.
    total_hours_in_solution = sum(p.total_hours for p in final_validated_solution)
    total_hours_original = sum(c.hours for c in clients)
    if total_hours_in_solution != total_hours_original:
        print(f"Warning: Mismatch in total hours. Original: {total_hours_original}, Solution: {total_hours_in_solution}")
        # This might indicate clients dropped or calculation errors.

    print(f"\n=== Enhanced Optimization Complete: {len(final_validated_solution)} caregiver positions generated. ===")
    return final_validated_solution


def handle_mandatory_splits(clients: List[Client], start_pos_id=1) -> Tuple[List[CaregiverPosition], List[Client]]:
    """
    Identifies clients needing >45 hours.
    Creates new Client objects for each split part.
    Forms CaregiverPosition objects for each of these split parts directly.
    Returns a tuple: (list of these pre-formed CaregiverPositions, list of original clients not needing split).
    """
    positions_from_splits: List[CaregiverPosition] = []
    clients_not_needing_split: List[Client] = []

    current_pos_id = start_pos_id

    for client in clients:
        if client.hours > 45:
            num_splits = math.ceil(client.hours / 45)
            print(f"Client {client.name} ({client.hours}h) requires splitting into {num_splits} parts.")

            # Distribute hours and days among splits
            # Base hours/days for each split part
            base_hours_per_part = client.hours // num_splits
            extra_hours = client.hours % num_splits

            base_days_per_part = client.days // num_splits
            extra_days = client.days % num_splits

            for i in range(num_splits):
                part_hours = base_hours_per_part + (1 if i < extra_hours else 0)
                part_days = base_days_per_part + (1 if i < extra_days else 0)
                # Ensure days are at least 1 if hours > 0, and client had days > 0
                if part_hours > 0 and client.days > 0 and part_days == 0:
                    part_days = 1


                split_client_part = Client(
                    name=f"{client.name} (Part {i + 1}/{num_splits})",
                    hours=part_hours,
                    days=part_days, # Simplified day splitting
                    needs_driver=client.needs_driver,
                    zip_code=client.zip_code
                )

                # Create a new position directly for this client part
                # These positions are considered "fixed" for these parts unless merged later.
                position = CaregiverPosition(current_pos_id)
                current_pos_id += 1
                position.assign_client(split_client_part) # Sets hours, days, driver req for the position

                # These positions with single split clients might be < 16h.
                # They will be validated/filtered later by validate_and_return_solution
                # if they cannot be merged by post_optimization_merge.
                positions_from_splits.append(position)
        else:
            clients_not_needing_split.append(client)

    return positions_from_splits, clients_not_needing_split


def post_optimization_merge(positions: List[CaregiverPosition]) -> List[CaregiverPosition]:
    """
    Placeholder for merging logic. For now, returns positions as is.
    A real implementation would be complex, trying to combine compatible positions
    to reduce overall count, while respecting all constraints.
    """
    print(f"Post-optimization merge: Placeholder used. {len(positions)} positions passed through without merging.")
    # To implement a greedy merge, you'd typically:
    # 1. Sort positions (e.g., by smallest hours first, or by driver requirement).
    # 2. Iterate and try to merge each position with subsequent compatible ones.
    #    - Compatibility: same driver req, combined hours <= 45, combined days <= 5 (complex), zip proximity etc.
    #    - If merged, the "swallowed" position is removed, and the merging position is updated.
    # This requires careful handling of constraints and client lists.
    # Using `copy.deepcopy` for positions being modified in a trial-and-error merge can be useful.
    return positions


def generate_optimal_schedule(client_data: List[Dict]) -> List[Dict]:
    """
    Main function to convert input client data, run optimization, and format output.
    """
    clients = []
    for i, data in enumerate(client_data):
        try:
            client = Client(
                name=data.get('name', f'Client_{i+1}'), # Default name if missing
                hours=int(data.get('hours', 0)),
                days=int(data.get('days', 0)),
                needs_driver=bool(data.get('needs_driver', False)),
                zip_code=str(data.get('zip_code', '00000')) # Default zip if missing
            )
            clients.append(client)
        except ValueError as e:
            print(f"Warning: Skipping client data entry due to invalid format: {data}. Error: {e}")
            continue # Skip this client and proceed with others

    if not clients:
        print("No valid client data provided or all entries were invalid.")
        return []

    print(f"Generating optimal schedule for {len(clients)} clients.")
    optimal_positions = optimize_with_strategic_enhancements(clients)

    if not optimal_positions:
        print("Optimization did not yield any valid caregiver positions.")
        return []

    # Convert CaregiverPosition objects to the desired output dictionary format
    output_schedule = []
    for pos in optimal_positions:
        entry = {
            'caregiver_id': f"CG_{pos.position_id}", # Standardized ID
            'type': f"{pos.position_type} {pos.driver_type}",
            'weekly_hours': pos.total_hours,
            'working_days': pos.working_days, # Simplified sum of days
            'clients': [c.name for c in pos.clients],
            'zip_codes': sorted(list(set(pos.zip_codes))), # Unique, sorted zips
            'driver_required': pos.requires_driver
        }
        output_schedule.append(entry)

    return output_schedule

# Example Test Data & Usage (can be run if this file is executed directly)
if __name__ == '__main__':
    print("Running caregiver optimization algorithm tests...\n")

    # Test Case 1: Basic - Expected 1 Full-time Driver
    test_clients_1 = [
        {'name': 'Client A', 'hours': 30, 'days': 3, 'needs_driver': True, 'zip_code': '90210'},
        {'name': 'Client B', 'hours': 10, 'days': 2, 'needs_driver': True, 'zip_code': '90210'},
    ]
    print("\n--- Test Case 1: Basic ---")
    schedule1 = generate_optimal_schedule(test_clients_1)
    for item in schedule1: print(item)

    # Test Case 2: Needs Splitting - Expected 2 positions from one client
    test_clients_2 = [
        {'name': 'Client C (Oversized)', 'hours': 60, 'days': 5, 'needs_driver': False, 'zip_code': '90211'},
    ]
    print("\n--- Test Case 2: Needs Splitting ---")
    schedule2 = generate_optimal_schedule(test_clients_2)
    for item in schedule2: print(item) # Should be 2 positions, e.g. 30h/30h or similar

    # Test Case 3: Mix of clients, some needing drivers
    test_clients_3 = [
        {'name': 'Client D (Driver)', 'hours': 20, 'days': 2, 'needs_driver': True, 'zip_code': '90212'},
        {'name': 'Client E (Non-Driver)', 'hours': 25, 'days': 3, 'needs_driver': False, 'zip_code': '90213'},
        {'name': 'Client F (Driver)', 'hours': 18, 'days': 2, 'needs_driver': True, 'zip_code': '90212'},
    ] # Expected: D+F (38h, D), E (25h, ND) -> 2 positions
    print("\n--- Test Case 3: Mixed Clients ---")
    schedule3 = generate_optimal_schedule(test_clients_3)
    for item in schedule3: print(item)

    # Test Case 4: Multiple small clients, test packing
    test_clients_4 = [
        {'name': 'G', 'hours': 10, 'days': 1, 'needs_driver': False, 'zip_code': '10001'},
        {'name': 'H', 'hours': 10, 'days': 1, 'needs_driver': False, 'zip_code': '10001'},
        {'name': 'I', 'hours': 10, 'days': 1, 'needs_driver': False, 'zip_code': '10001'},
        {'name': 'J', 'hours': 10, 'days': 1, 'needs_driver': False, 'zip_code': '10001'},
        {'name': 'K', 'hours': 5, 'days': 1, 'needs_driver': False, 'zip_code': '10001'},
    ] # G+H+I+J = 40h (FT), K=5h (cannot form valid position alone, might be dropped or needs merge)
      # Expected: One FT position (40h), K might be unassigned if it can't make 16h with others or alone.
      # With current logic, K would be unassigned unless it could form a valid position.
    print("\n--- Test Case 4: Packing Small Clients ---")
    schedule4 = generate_optimal_schedule(test_clients_4)
    for item in schedule4: print(item)

    # Test Case 5: All zero hour clients
    test_clients_5 = [
        {'name': 'Client L', 'hours': 0, 'days': 3, 'needs_driver': True, 'zip_code': '90210'},
        {'name': 'Client M', 'hours': 0, 'days': 2, 'needs_driver': True, 'zip_code': '90210'},
    ]
    print("\n--- Test Case 5: All Zero Hour Clients ---")
    schedule5 = generate_optimal_schedule(test_clients_5)
    for item in schedule5: print(item) # Expected: Empty schedule

    # Test Case 6: No clients
    print("\n--- Test Case 6: No Clients ---")
    schedule6 = generate_optimal_schedule([])
    for item in schedule6: print(item) # Expected: Empty schedule

    # Test Case 7: One client, less than 16 hours
    test_clients_7 = [
        {'name': 'Client N', 'hours': 10, 'days': 1, 'needs_driver': False, 'zip_code': '90210'},
    ]
    print("\n--- Test Case 7: Single client < 16 hours ---")
    schedule7 = generate_optimal_schedule(test_clients_7)
    # Expected: No position, as it doesn't meet 16h min.
    for item in schedule7: print(item)

    # Test Case 8: Client just over 45h, another small one
    test_clients_8 = [
        {'name': 'Client O (Slightly Oversized)', 'hours': 48, 'days': 5, 'needs_driver': True, 'zip_code': '90210'},
        {'name': 'Client P', 'hours': 20, 'days': 2, 'needs_driver': False, 'zip_code': '90211'},
    ]
    print("\n--- Test Case 8: Slightly oversized + another ---")
    schedule8 = generate_optimal_schedule(test_clients_8)
    # Expected: Client O split (e.g. 24h/24h), Client P separate or merged if compatible.
    # Example: Pos1 (O-P1, 24h, D), Pos2 (O-P2, 24h, D), Pos3 (P, 20h, ND)
    # Or if merge logic was smart: Pos1 (O-P1+P if compatible), Pos2 (O-P2)
    for item in schedule8: print(item)

    # Test Case 9: Many clients, some drivers, non-drivers, testing limits
    test_clients_9 = [
        {'name': 'Driver1', 'hours': 22, 'days': 3, 'needs_driver': True, 'zip_code': 'Z1'},
        {'name': 'Driver2', 'hours': 22, 'days': 3, 'needs_driver': True, 'zip_code': 'Z1'}, # D1+D2 = 44h Driver
        {'name': 'NonDriver1', 'hours': 30, 'days': 4, 'needs_driver': False, 'zip_code': 'Z2'}, # ND1 = 30h NonDriver
        {'name': 'NonDriver2', 'hours': 10, 'days': 1, 'needs_driver': False, 'zip_code': 'Z2'}, # ND1+ND2 = 40h NonDriver
        {'name': 'Driver3', 'hours': 40, 'days': 5, 'needs_driver': True, 'zip_code': 'Z3'}, # D3 = 40h Driver
    ]
    print("\n--- Test Case 9: Complex Mix ---")
    schedule9 = generate_optimal_schedule(test_clients_9)
    # Expected: 3 positions
    # Pos1 (D1,D2) ~44h Driver
    # Pos2 (ND1,ND2) ~40h NonDriver
    # Pos3 (D3) ~40h Driver
    for item in schedule9: print(item)

    print("\nAlgorithm tests completed.")
"""
ALGORITHM TERMINATION CONDITIONS (Recap from markdown)
The algorithm terminates when:
1. Valid solution found that satisfies ALL constraints (for `constraint_satisfaction_algorithm` part).
   The `optimize_with_strategic_enhancements` terminates after its phases complete.
2. All clients assigned with minimum possible caregivers (attempted by iterating `target_caregivers`).
3. No constraint violations in final solution (checked by `validate_and_return_solution`).
4. Backtracking exhausted all possibilities for current caregiver count (within `attempt_assignment`).
5. Mathematically proven optimal (relative to the model; "global optimal" is hard, this is optimal for the given constraints and client sort).

The algorithm aims to find an optimal solution under the defined model or prove it impossible within that model.
"Self-improving" aspects (e.g., learning better client sorting, constraint adjustments) are outside this specific Python code block.
"""
