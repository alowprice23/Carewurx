# Carewurx V2 Development Progress

## Initial Request Overview

The goal is to create Carewurx Version 2, building upon the working parts of the original Carewurx. This new version will emphasize group chat functionality for office staff and incorporate a self-improving caregiver optimization algorithm. Key areas for overhaul include the caregiver/client profiles and the scheduling system, which needs a user experience revamp focusing on a filterable calendar view. Codebase consistency and uniformity are also major objectives.

## Core Requirements & Features:

*   **Branching Strategy:** Create a `carewurx-v2` branch.
*   **Feature Parity:** Ensure no features from the working version of Carewurx are lost.
*   **Group Chat:** Implement robust group chat functionality for office staff.
*   **Self-Improving Algorithm:**
    *   Integrate and enhance the provided `CONSTRAINT-SATISFACTION CAREGIVER OPTIMIZATION ALGORITHM`.
    *   Focus on self-improvement for caregiver profiles, client profiles, and the scheduling system.
*   **Scheduling System UX Overhaul:**
    *   Implement a calendar section.
    *   Allow filtering by client.
    *   Display schedules for all actively working caregivers.
    *   Include a section for newly onboarded caregivers needing cases.
*   **Codebase Improvements:**
    *   Enhance front-end display logic.
    *   Improve uniformity and consistency across the codebase.
*   **Firebase Credentials:** Copy existing credentials.
*   **Agentic System (Internal LLM):**
    *   Explore integration within group chats for awareness.
    *   Utilize for finding combinations and opportunities.
    *   Enable constant "thinking" based on algorithm results.
*   **Progress Tracking:** This markdown file will serve as the progress tracker.

## Constraint-Satisfaction Caregiver Optimization Algorithm

```python
import math
from typing import List, Dict, Set, Tuple, Optional

class Client:
    def __init__(self, name: str, hours: int, days: int, needs_driver: bool, zip_code: str):
        self.name = name
        self.hours = hours
        self.days = days
        self.needs_driver = needs_driver
        self.zip_code = zip_code

class CaregiverPosition:
    def __init__(self, position_id: int):
        self.position_id = position_id
        self.clients = []
        self.total_hours = 0
        self.working_days = 0
        self.requires_driver = None  # Set by first client assignment
        self.zip_codes = []

    def can_accept_client(self, client: Client) -> bool:
        """Check if position can accept this client based on ALL constraints"""

        # CONSTRAINT 1: Driver requirement consistency
        if self.requires_driver is not None and client.needs_driver != self.requires_driver:
            return False

        # CONSTRAINT 2: Hour limit (45h max)
        if self.total_hours + client.hours > 45:
            return False

        # CONSTRAINT 3: Minimum viable hours (16h min for position)
        projected_hours = self.total_hours + client.hours
        # This constraint seems to be applied too early. A position might start below 16h
        # and become viable as more clients are added.
        # if projected_hours < 16 and len(self.clients) == 0: # Apply only if it's the first client and won't reach 16h
        #     pass # Let's defer this to final validation or a check after all clients for a position are tentatively assigned.

        # CONSTRAINT 4: Part-time limit (24h max for part-time)
        # This is more of a classification rule than an acceptance constraint during assignment.
        # The 45h max (CONSTRAINT 2) is the primary upper bound.

        # CONSTRAINT 5: Day limit (5 days max)
        projected_days = self.working_days + client.days # Simplified, assumes no overlap
        if projected_days > 5:
            return False

        # CONSTRAINT 6: One shift per day (no overlapping schedules)
        # Note: This would require detailed schedule parsing in real implementation

        return True

    def assign_client(self, client: Client):
        """Assign client to this position"""
        if self.requires_driver is None:
            self.requires_driver = client.needs_driver

        self.clients.append(client)
        self.total_hours += client.hours
        self.working_days += client.days  # Simplified - may overlap in reality
        self.zip_codes.append(client.zip_code)

def constraint_satisfaction_algorithm(clients: List[Client]) -> List[CaregiverPosition]:
    """
    MAIN ALGORITHM: Find minimum caregivers using constraint satisfaction
    """

    # PHASE 1: Calculate Optimization Bounds
    total_hours = sum(client.hours for client in clients)
    if total_hours == 0 and not clients: # Handle empty client list
        return []
    if total_hours == 0 and clients: # Handle clients with 0 hours
        # Decide if these clients should result in empty positions or be ignored
        # For now, let's assume they might still need a position if they exist
        pass

    theoretical_min = math.ceil(total_hours / 45) if total_hours > 0 else 0
    # If all clients have 0 hours, but we have clients, we might need 1 caregiver per client if they must be assigned.
    # However, the current logic would make theoretical_min = 0.
    # If there are clients, theoretical_min should be at least 1 if any client needs assignment.
    # This nuance depends on business rules for 0-hour clients.
    # For now, if total_hours is 0 but clients exist, let's assume we still try to assign them.
    if theoretical_min == 0 and clients:
        # This case means all clients have 0 hours.
        # The algorithm might struggle if it tries to assign 0 caregivers.
        # Let's ensure at least one caregiver is tried if clients exist.
        # Or, if 0-hour clients don't need assignment, filter them out first.
        # For this pass, we'll let it be, but it's a point of attention.
        pass

    practical_max = len(clients)

    print(f"Optimization Range: {theoretical_min}-{practical_max} caregivers")
    print(f"Total Hours: {total_hours}h")

    # PHASE 2: Try each possible caregiver count (start from minimum)
    # Ensure theoretical_min is at least 1 if there are clients to assign and total_hours > 0
    # If total_hours is 0, but clients exist, and they MUST be assigned, then theoretical_min should be len(clients)
    # if they can't be grouped (e.g. 0 hour clients still form a "position").
    # This needs clarification. For now, if total_hours = 0, and clients > 0, let's make min_caregivers = 1
    # to avoid range(0,X) if not intended. Or, if they are truly 0-effort, they might not need a caregiver.

    start_range = theoretical_min
    if total_hours == 0 and len(clients) > 0:
        # If clients exist but have no hours, the definition of "optimal" is unclear.
        # Do they still need to be assigned to a caregiver slot?
        # The current constraints (like min 16h) would prevent assigning them.
        # Let's assume for now such clients should be filtered or handled separately if they don't contribute to hours.
        # If they MUST be assigned, the constraints need adjustment.
        # For now, if no hours, no caregivers needed by this logic.
        if not any(c.hours > 0 for c in clients):
            print("All clients have 0 hours. No caregivers assigned by this algorithm.")
            return []


    for target_caregivers in range(max(1, start_range) if clients else 0, practical_max + 1):
        print(f"\nAttempting solution with {target_caregivers} caregivers...")

        solution = attempt_assignment(clients, target_caregivers)

        if solution is not None:
            # Validate that the solution actually uses target_caregivers or fewer,
            # and that all clients are assigned.
            assigned_clients_count = sum(len(pos.clients) for pos in solution)
            if assigned_clients_count == len(clients):
                 print(f"✅ Potential solution found with {len(solution)} caregivers (target was {target_caregivers})")
                 # The validate_and_return_solution will strip empty positions.
                 # The core idea is to find if *a* solution exists with *up to* target_caregivers,
                 # where those caregivers meet min requirements.
                 return solution # Return the first valid solution found.
            else:
                print(f"⚠️ Solution found but not all clients assigned ({assigned_clients_count}/{len(clients)})")

        print(f"❌ Cannot solve with {target_caregivers} caregivers or fewer satisfying all constraints for all clients.")
        # If attempt_assignment returns None, it means it couldn't assign all clients with that many caregivers.

    # If loop finishes, no solution found for any number of caregivers in the range.
    # This implies either clients list was empty and handled, or no assignment is possible.
    if clients: # Only raise if there were clients to assign
        raise Exception("No valid solution found for the given clients and constraints.")
    return [] # Return empty list if no clients or no solution needed/found

def attempt_assignment(clients: List[Client], target_caregivers: int) -> Optional[List[CaregiverPosition]]:
    """
    Try to assign ALL clients using EXACTLY target_caregivers
    Returns None if impossible, valid solution if successful
    """
    if not clients:
        return [] # No clients, empty solution

    # Initialize caregiver positions
    positions = [CaregiverPosition(i + 1) for i in range(target_caregivers)]

    # Sort clients by assignment difficulty (hardest first)
    sorted_clients = sort_by_assignment_difficulty(clients)

    # Use backtracking to find valid assignment
    # The result of backtrack_assignment will be the list of positions.
    # We need to ensure all clients were actually assigned.
    assigned_positions = backtrack_assignment(sorted_clients, positions, 0)

    if assigned_positions:
        # Check if all clients are in the solution
        all_assigned_clients = set()
        for pos in assigned_positions:
            for client in pos.clients:
                all_assigned_clients.add(client.name) # Assuming client names are unique for this check

        if len(all_assigned_clients) == len(clients):
            return validate_and_return_solution(assigned_positions)
        else:
            # Not all clients were assigned, so this is not a valid solution for *all* clients
            return None
    else:
        return None

def sort_by_assignment_difficulty(clients: List[Client]) -> List[Client]:
    """
    Sort clients by assignment difficulty (hardest first)
    Priority: 1) Driver clients, 2) High hours, 3) Many days
    """

    def difficulty_score(client: Client) -> Tuple[int, int, int]:
        # Lower score = higher priority (sorted ascending)
        driver_priority = 0 if client.needs_driver else 1  # Drivers first
        hour_priority = -client.hours  # Higher hours first (negative for ascending)
        day_priority = -client.days   # More days first (negative for ascending)

        return (driver_priority, hour_priority, day_priority)

    return sorted(clients, key=difficulty_score)

def backtrack_assignment(clients: List[Client], positions: List[CaregiverPosition],
                        client_index: int) -> Optional[List[CaregiverPosition]]:
    """
    BACKTRACKING ALGORITHM: Try every possible assignment combination
    """

    # Base case: All clients assigned successfully
    if client_index >= len(clients):
        # At this point, all clients have been placed into *some* position.
        # The final validation of whether these positions are valid (e.g. meet min hours)
        # happens in all_constraints_satisfied, called by validate_and_return_solution.
        return positions

    current_client = clients[client_index]

    # Try assigning current client to each position
    for position_idx, position in enumerate(positions): # Iterate with index for potential modification/logging
        if position.can_accept_client(current_client):

            # Make assignment (forward step)
            original_requires_driver = position.requires_driver
            position.assign_client(current_client)

            # Recursively try to assign remaining clients
            result = backtrack_assignment(clients, positions, client_index + 1)

            if result is not None:
                return result  # Found valid complete assignment path

            # Backtrack: Remove assignment and try next position
            position.clients.remove(current_client)
            position.total_hours -= current_client.hours
            position.working_days -= current_client.days # Simplified
            if client.zip_code in position.zip_codes: # Ensure it exists before removing
                position.zip_codes.remove(client.zip_code)

            # Reset driver requirement if this was the only client setting it
            if len(position.clients) == 0:
                position.requires_driver = None
            elif original_requires_driver is None and position.requires_driver is not None:
                # If this client set the driver requirement, and it's now removed,
                # we need to re-evaluate based on remaining clients or set to None if empty.
                # This logic is tricky: assign_client sets it, removing should correctly unset or re-evaluate.
                # A simpler way: if after removing, no clients need a driver, set to False. If any client needs, set to True. If empty, None.
                if not any(c.needs_driver for c in position.clients):
                    position.requires_driver = False # Or None if we want to be strict about "set by first client"
                else:
                    # At least one remaining client needs a driver
                    position.requires_driver = True


    # No valid assignment found for current client with current positions setup
    return None

def all_constraints_satisfied(positions: List[CaregiverPosition]) -> bool:
    """
    FINAL VALIDATION: Ensure all constraints are met for non-empty positions
    """

    for position in positions:
        # Skip empty positions for validation, they will be removed by validate_and_return_solution
        if not position.clients:
            continue

        # CONSTRAINT CHECK 1: Hour limits (min 16h, max 45h for a populated position)
        if not (16 <= position.total_hours <= 45):
            # print(f"Debug: Position {position.position_id} failed hour limits: {position.total_hours}")
            return False

        # CONSTRAINT CHECK 2: Part-time classification (already handled by type assignment, not a failure condition here)
        # if position.total_hours <= 24:  # Part-time
        #     pass
        # elif position.total_hours <= 45:  # Full-time
        #     pass
        # else: # Should be caught by above
        #     return False

        # CONSTRAINT CHECK 3: Day limits
        if position.working_days > 5: # Simplified sum of days
            # print(f"Debug: Position {position.position_id} failed day limits: {position.working_days}")
            return False

        # CONSTRAINT CHECK 4: Driver consistency
        if position.clients: # Only if there are clients
            driver_requirements = {client.needs_driver for client in position.clients}
            if len(driver_requirements) > 1:  # Mixed driver requirements in one position
                # print(f"Debug: Position {position.position_id} failed driver consistency: {driver_requirements}")
                return False
            # Also ensure the position's requires_driver flag matches the clients
            if position.requires_driver != driver_requirements.pop():
                # print(f"Debug: Position {position.position_id} flag mismatch on driver req.")
                return False

    return True

def validate_and_return_solution(positions: List[CaregiverPosition]) -> Optional[List[CaregiverPosition]]:
    """
    Final validation and cleanup of solution.
    Returns a list of valid positions, or None if validation fails.
    """

    # Filter out positions that are empty (no clients assigned)
    populated_positions = [pos for pos in positions if pos.clients]

    # Final constraint check on these populated positions
    if not all_constraints_satisfied(populated_positions):
        # print("Debug: validate_and_return_solution failed all_constraints_satisfied.")
        return None # Indicates that this set of assignments, even if all clients are covered, is not valid.

    # Generate position details for valid, populated positions
    final_positions = []
    for i, position in enumerate(populated_positions):
        position.position_id = i + 1 # Re-ID the positions sequentially
        position.position_type = "Part-time" if position.total_hours <= 24 else "Full-time"
        # Ensure requires_driver is correctly set based on clients, if not already
        if position.clients:
            position.requires_driver = any(c.needs_driver for c in position.clients)
        else: # Should not happen due to filter, but defensively
            position.requires_driver = False
        position.driver_type = "Driver" if position.requires_driver else "Non-driver"
        final_positions.append(position)

    return final_positions


def optimize_with_strategic_enhancements(clients: List[Client]) -> List[CaregiverPosition]:
    """
    ENHANCED ALGORITHM: Add strategic optimizations before constraint satisfaction
    """
    if not clients:
        return []

    print("=== ENHANCED CONSTRAINT-SATISFACTION ALGORITHM ===")

    # PHASE 1: Handle mandatory splits (>45 hours)
    # These create new "sub-clients" that must be assigned.
    # The original client is effectively replaced by these sub-clients.
    split_positions_from_oversized_clients, remaining_clients_after_split = handle_mandatory_splits(clients)

    # PHASE 2: Apply constraint satisfaction to remaining (or newly formed sub-clients)
    # If a client was split, its parts are in remaining_clients_after_split
    # split_positions_from_oversized_clients are positions that are ALREADY FORMED and contain parts of >45h clients.
    # These positions are by definition valid regarding their single client's split part.
    # They might be mergeable later.

    # The core algorithm should now run on `remaining_clients_after_split`
    # to assign them to *new* positions.

    print(f"Clients after mandatory splits: {[c.name for c in remaining_clients_after_split]}")

    # We need a fresh set of positions for these remaining clients.
    # The `constraint_satisfaction_algorithm` will find the optimal number of *additional* caregivers.
    additional_positions = []
    if remaining_clients_after_split:
        additional_positions = constraint_satisfaction_algorithm(remaining_clients_after_split)
        if additional_positions is None: # Should return [] if no solution, or raise exception
             print("Warning: constraint_satisfaction_algorithm returned None for remaining clients.")
             additional_positions = []


    # PHASE 3: Combine results
    # The split_positions_from_oversized_clients are already positions.
    # The additional_positions are also positions.
    # We need to combine these two lists of positions.
    # Ensure position IDs are unique across both sets before combining.
    current_max_id = 0
    for pos in split_positions_from_oversized_clients:
        if pos.position_id > current_max_id:
            current_max_id = pos.position_id

    for pos in additional_positions:
        current_max_id += 1
        pos.position_id = current_max_id

    final_solution_pre_merge = split_positions_from_oversized_clients + additional_positions

    # PHASE 4: Post-optimization (try to merge positions if possible)
    # This is where we could try to merge some of the `split_positions_from_oversized_clients`
    # with `additional_positions` or among themselves if they are compatible.
    # For now, the provided post_optimization_merge is a placeholder.
    optimized_solution = post_optimization_merge(final_solution_pre_merge)

    # Final validation and detailing for the combined and potentially merged solution
    # The `validate_and_return_solution` also re-IDs positions and sets types.
    final_validated_solution = validate_and_return_solution(optimized_solution)

    if final_validated_solution is None:
        # This would mean that even after splitting and standard assignment, the combination is invalid.
        # This should ideally not happen if components are valid.
        # It might happen if post_optimization_merge creates invalid states not caught.
        # Or if `validate_and_return_solution` has stricter checks.
        # For safety, return the pre-merge solution if validation fails, or handle error.
        print("Warning: Final merged solution failed validation. Returning pre-merge solution if valid, or pre-additional if not.")
        # Fallback: check if final_solution_pre_merge is valid
        pre_merge_validated = validate_and_return_solution(final_solution_pre_merge)
        if pre_merge_validated:
            return pre_merge_validated
        # Even more fallback: just return the additional positions if they are valid and splits were empty
        elif not split_positions_from_oversized_clients and additional_positions:
             # This means only additional_positions were there, and they must be valid if returned by CSA
             return additional_positions
        elif split_positions_from_oversized_clients and not additional_positions:
             # Only split positions, which should be validated individually
             return validate_and_return_solution(split_positions_from_oversized_clients)

        # If everything fails, means something is fundamentally wrong.
        # For now, let's assume validate_and_return_solution on optimized_solution will work or raise.
        # If it returns None, it implies no valid combined schedule.
        # Let's reconsider the flow: `optimize_with_strategic_enhancements` should return List[CaregiverPosition]
        # If no solution, it should be an empty list or raise exception upstream.
        # `constraint_satisfaction_algorithm` raises if no solution.
        # `handle_mandatory_splits` does not.
        # `validate_and_return_solution` returns None if invalid.

        # If `final_validated_solution` is None, this means the merged solution is not valid.
        # This implies an issue in merging or the constituent parts.
        # The `constraint_satisfaction_algorithm` should have returned valid parts or raised an error.
        # `handle_mandatory_splits` creates positions that should be inherently valid for their single split client.
        # The issue is likely in `post_optimization_merge` if it makes things invalid,
        # or if `validate_and_return_solution` has a problem.

        # Given the current structure, if `final_validated_solution` is None,
        # it means the overall combination (possibly after merge) is not viable under final checks.
        # This function should then indicate no solution.
        if final_validated_solution is None:
            print("ERROR: The combined and optimized solution did not pass final validation.")
            # Depending on desired behavior, either return empty list or raise exception.
            # For now, let's align with CSA and let an empty list signify "no solution found under these conditions".
            return []


    return final_validated_solution


def handle_mandatory_splits(clients: List[Client]) -> Tuple[List[CaregiverPosition], List[Client]]:
    """
    Handle clients requiring splits (>45 hours).
    Returns a tuple:
    1. List of CaregiverPosition objects, each containing one "split part" of an oversized client.
       These positions are considered formed and valid for that part.
    2. List of Client objects that are NOT oversized (includes original non-oversized clients
       AND the newly created "split part" clients if we decide to re-process them instead of pre-forming positions).

    Current Implementation: Pre-forms positions for split parts.
    Alternative: Return split parts as new clients to be processed by the main algorithm.
                 This might be more flexible for the main algorithm to combine them optimally.
                 Let's try the alternative: return Client objects for split parts.
    """

    final_client_list_for_main_algo = []
    pre_formed_positions_for_splits = [] # Let's stick to pre-forming for now.
    next_position_id = 1

    for client in clients:
        if client.hours > 45:
            num_splits = math.ceil(client.hours / 45)
            base_hours_per_split = client.hours // num_splits
            remainder_hours = client.hours % num_splits

            # Distribute days somewhat proportionally, ensuring each split has at least 1 day if original client had days
            base_days_per_split = 0
            remainder_days = 0
            if client.days > 0 :
                base_days_per_split = max(1, client.days // num_splits) # Each split gets at least 1 day
                remainder_days = client.days % num_splits
                # Adjust if sum of base_days_per_split * num_splits exceeds client.days due to min 1 day
                while (base_days_per_split * num_splits + remainder_days > client.days and base_days_per_split > 1):
                    base_days_per_split -=1
                    remainder_days = client.days - (base_days_per_split * num_splits)


            print(f"Mandatory split: {client.name} ({client.hours}h, {client.days}d) → {num_splits} positions")

            current_client_total_hours_assigned = 0
            current_client_total_days_assigned = 0

            for i in range(num_splits):
                split_hours = base_hours_per_split
                if remainder_hours > 0:
                    split_hours += 1
                    remainder_hours -= 1

                current_client_total_hours_assigned += split_hours

                split_days = base_days_per_split
                if remainder_days > 0:
                    split_days +=1
                    remainder_days -=1
                current_client_total_days_assigned += split_days

                # Ensure last split gets exact remaining hours/days if rounding caused drift
                if i == num_splits - 1:
                    split_hours += (client.hours - current_client_total_hours_assigned)
                    split_days += (client.days - current_client_total_days_assigned)


                # Create split client part
                split_client_part = Client(
                    name=f"{client.name} - Part {i + 1}/{num_splits}",
                    hours=int(round(split_hours)), # Rounding to handle potential float issues
                    days=int(round(split_days)),    # Rounding days
                    needs_driver=client.needs_driver,
                    zip_code=client.zip_code
                )

                # Create a dedicated position for this part
                # These positions are minimal and might be mergeable later in post-optimization
                position = CaregiverPosition(next_position_id)
                next_position_id +=1
                position.assign_client(split_client_part) # This also sets driver req, hours, days for the position

                # Validate this individually created position (it should be valid if hours <= 45 and >= 16)
                # The min 16h constraint might be an issue if a split part is too small.
                # Business rule: can a split part be < 16h if the original client was large?
                # For now, assume split parts must also adhere if they form their own position.
                # However, the current `validate_and_return_solution` checks this.
                # Let's assume `assign_client` is fine, and `post_optimization_merge` or final validation handles viability.
                pre_formed_positions_for_splits.append(position)

        else: # Client does not need splitting
            final_client_list_for_main_algo.append(client)

    # The `final_client_list_for_main_algo` now contains only clients that are <= 45 hours.
    # The `pre_formed_positions_for_splits` contains positions each holding one part of a >45h client.
    return pre_formed_positions_for_splits, final_client_list_for_main_algo


def post_optimization_merge(positions: List[CaregiverPosition]) -> List[CaregiverPosition]:
    """
    Try to merge compatible positions to reduce total count.
    This is a complex task. A simple greedy approach:
    Iterate through positions, try to merge each with subsequent compatible positions.
    """
    if not positions:
        return []

    merged_positions = []
    # Create a mutable list of positions to work with
    # Sort positions to make merging more predictable, e.g., by number of clients or total hours
    # For now, use as is. A deepcopy might be safer if objects are modified then reverted.

    # Let's try a simpler approach for now: this function is a placeholder.
    # A full merge logic is non-trivial.
    # For V2 initial, we might just return positions as is, or do a very basic merge.
    # print(f"Post-optimization: Attempting to merge {len(positions)} positions.")

    # Basic placeholder: just return the positions without merging for now.
    # Merging needs careful constraint checking (hours, days, driver, zips if relevant for merge)
    # This is a significant sub-problem.
    # For example, a greedy merge:
    # positions_to_merge = sorted(positions, key=lambda p: p.total_hours) # Smallest first
    # merged_list = []
    # merged_out_indices = [False] * len(positions_to_merge)

    # for i in range(len(positions_to_merge)):
    #     if merged_out_indices[i]:
    #         continue

    #     current_pos = copy.deepcopy(positions_to_merge[i]) # Work with a copy

    #     for j in range(i + 1, len(positions_to_merge)):
    #         if merged_out_indices[j]:
    #             continue

    #         other_pos = positions_to_merge[j]

    #         # Check compatibility for merging current_pos and other_pos
    #         can_merge = True
    #         # 1. Driver requirement: must be same or one is non-driver and can adopt
    #         if current_pos.requires_driver is not None and other_pos.requires_driver is not None and \
    #            current_pos.requires_driver != other_pos.requires_driver:
    #             can_merge = False

    #         # 2. Combined hours <= 45
    #         if current_pos.total_hours + other_pos.total_hours > 45:
    #             can_merge = False

    #         # 3. Combined days <= 5 (simplified sum)
    #         if current_pos.working_days + other_pos.working_days > 5: # Needs more sophisticated day merge logic
    #             can_merge = False

    #         # (Add zip code proximity logic if needed)

    #         if can_merge:
    #             print(f"Merging position {current_pos.position_id} with {other_pos.position_id}")
    #             # Perform merge
    #             for client in other_pos.clients:
    #                 current_pos.clients.append(client)
    #             current_pos.total_hours += other_pos.total_hours
    #             current_pos.working_days += other_pos.working_days # Needs refinement
    #             current_pos.zip_codes.extend(other_pos.zip_codes)
    #             if other_pos.requires_driver: # If the merged position required a driver, the result does
    #                 current_pos.requires_driver = True

    #             merged_out_indices[j] = True # Mark other_pos as merged

    #     merged_list.append(current_pos)
    # return merged_list

    # For now, returning as is, as merge logic is complex.
    return positions


# EXAMPLE USAGE AND IMPLEMENTATION

def generate_optimal_schedule(client_data: List[Dict]) -> List[Dict]:
    """
    Main function to generate optimal caregiver schedule
    """

    # Convert input data to Client objects
    clients = []
    for data in client_data:
        client = Client(
            name=data.get('name', 'Unknown Client'),
            hours=data.get('hours', 0),
            days=data.get('days', 0),
            needs_driver=data.get('needs_driver', False),
            zip_code=data.get('zip_code', 'N/A')
        )
        clients.append(client)

    if not clients:
        print("No client data provided.")
        return []

    # Apply optimization algorithm
    # This might raise an exception if no solution is found by constraint_satisfaction_algorithm
    try:
        optimal_positions = optimize_with_strategic_enhancements(clients)
    except Exception as e:
        print(f"Error during optimization: {e}")
        # Depending on desired behavior, could return empty list or re-raise
        return [] # Return empty schedule on error

    if not optimal_positions:
        print("No optimal schedule found.")
        return []

    # Convert to output format
    schedule = []
    for position in optimal_positions:
        # Ensure position type and driver type are set (should be by validate_and_return_solution)
        pos_type = getattr(position, 'position_type', "Unknown Type")
        drv_type = getattr(position, 'driver_type', "Unknown Driver Status")
        req_driver = getattr(position, 'requires_driver', False)

        schedule_entry = {
            'caregiver_id': f"CAREGIVER #{position.position_id}",
            'type': f"{pos_type} {drv_type}",
            'weekly_hours': position.total_hours,
            'working_days': position.working_days, # This is a simplified sum
            'clients': [client.name for client in position.clients],
            'zip_codes': list(set(position.zip_codes)), # Unique zip codes
            'driver_required': req_driver
        }
        schedule.append(schedule_entry)

    return schedule

# ALGORITHM TERMINATION CONDITIONS
"""
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

## Development Log & TODOs for V2

### Phase 1: Initial Setup & Algorithm Integration
*   [X] Create `carewurx-v2` branch (implicitly on first commit).
*   [X] Create `carewurx_v2_progress.md` with initial problem description and algorithm.
*   [X] Place algorithm into `python_agent/caregiver_optimizer.py`.
*   [X] Integrate `caregiver_optimizer.py` with `python_agent/main.py` (Flask endpoint `/optimize-schedule`).
*   [X] Add method `getOptimizedSchedule` to `services/enhanced-scheduler.js` to call the Python endpoint.
*   [ ] Identify existing branches/features to merge. (Status: Inferred `main` as base, pending further user input if specific branches are critical).
*   [X] Configure Firebase credentials:
    *   Created `frontend/src/services/firebaseConfig.js` with web app credentials and VAPID key.
    *   Added `frontend/src/services/firebaseConfig.js` to `.gitignore`.
    *   Updated `frontend/src/services/firebase.js` to use the new config file and Firebase v9 modular SDK.
    *   Noted that `services/firebase.js` (Admin SDK) uses service accounts and was not changed.

#### Notes on Algorithm Integration:
*   The Python agent (`python_agent/main.py`) must be running for the optimization endpoint to be available. Consider adding a script to `package.json` for launching it (e.g., `npm run start-python-agent`).
*   The Python agent's dependencies (`Flask`, `python-dotenv`, `crewai` and its transitive dependencies) need to be installed in its environment (update `python_agent/requirements.txt` if necessary).
*   The Node.js to Python HTTP call uses hardcoded `localhost:5001`. This should be made configurable for different environments.
*   Error handling for the inter-service call can be further enhanced (e.g., retries, circuit breakers for production).

### Phase 2: Core Feature Development - Scheduling & Profiles
*   **Scheduling System UX Overhaul:**
    *   [ ] Design new calendar section UI.
    *   [ ] Implement client filtering.
    *   [ ] Display active caregiver schedules.
    *   [ ] Section for unassigned new caregivers.
*   **Profile Improvements (Caregiver & Client):**
    *   [ ] Define data points for "self-improvement".
    *   [ ] Design UI for enhanced profiles.
    *   [ ] Implement backend logic for profile updates and learning.

### Phase 3: Communication & Advanced Features
*   **Group Chat:**
    *   [ ] Select/design chat module.
    *   [ ] Integrate into UI.
    *   [ ] Backend implementation for chat.
*   **Internal LLM / Agentic System:**
    *   [X] Define specific use cases and integration points (conceptualized for chat awareness and proactive opportunity/combination finding).
    *   [ ] Proof-of-concept for LLM awareness in chat (planned as part of Group Chat feature, Phase 5 - Step 6).
    *   [ ] Explore LLM for opportunity finding (conceptualized, to build on existing "scanner" components and Python agent capabilities; deferred to later V2 phase).

#### Notes on Internal LLM Integration:
*   **Chat Awareness:** As detailed in the "Group Chat Functionality Plan," an LLM can process chat messages asynchronously (e.g., via Firebase Functions) to tag topics, identify entities, detect sentiment/urgency, or summarize discussions. These insights can be stored with messages or in a related collection and subtly displayed in the UI. This is a good starting point for LLM integration.
*   **Proactive Agent for Combinations/Opportunities:**
    *   **Concept:** An LLM-powered agent (likely an extension of `python_agent/main.py` or using `agents/agent-manager.js`) could periodically or based on triggers:
        *   Analyze new client data, caregiver availability, and historical schedule outcomes.
        *   Use the caregiver optimization algorithm's results as input.
        *   Identify potential scheduling improvements, underutilized caregivers, client pairings, or emerging issues (e.g., high travel times for a caregiver).
        *   The existing `services/schedule-scanner.js` and `frontend/src/components/OpportunityScanner.jsx` could be the foundation for surfacing these LLM-generated opportunities.
    *   **"Constant Thinking":** This implies background processing. Firebase Functions triggered by data changes (e.g., new client, updated caregiver availability) or scheduled functions (e.g., nightly analysis) could invoke the LLM agent.
    *   **Challenges:** This is a complex R&D area. Defining effective prompts, managing context windows for the LLM, ensuring reliable data inputs, and presenting actionable insights to users are non-trivial.
*   **Phased Approach Recommended:**
    1.  Implement LLM for chat awareness first, as it's more bounded.
    2.  Develop the proactive "opportunity finding" agent as a subsequent major feature, potentially starting with rule-based heuristics and gradually incorporating more sophisticated LLM-driven analysis.
    3.  Focus on clear value propositions for LLM features to avoid over-complication.

### Phase 4: Refinement & Consistency
*   **Codebase Uniformity & Consistency (Ongoing Effort):**
    *   [X] Initial focus on consistency in Firebase Web SDK setup (`frontend/src/services/firebase.js` and `firebaseConfig.js`).
    *   [ ] **Linting and Formatting:** Review and enforce consistent linting (ESLint for JS/React, potentially Flake8/Black for Python) and formatting (Prettier for JS/React).
    *   [ ] **Component Structure (Frontend):** Promote small, reusable React components with consistent state management and props handling patterns for new V2 features.
    *   [ ] **Service Layers:** Maintain clear separation of concerns and consistent error handling in service layers (JS and Python).
    *   [ ] **Naming Conventions:** Adhere to standard naming conventions (e.g., PascalCase for React components, camelCase for JS functions/variables).
    *   [ ] **Refactoring:** Identify and undertake minor refactoring for consistency during new feature development. Note larger refactoring needs (e.g., `app/` vs `frontend/` consolidation) for future planning.
    *   [ ] **Documentation:** Encourage inline comments for complex logic and update/create `README.md` or `AGENTS.md` files for new modules or significant changes.
*   **Self-Improving Mechanisms (Profiles, Scheduling Algorithm):**
    *   [X] Conceptual framework defined (see notes below).
    *   [ ] **Data Collection:** Identify and ensure collection of key data points for profiles (caregiver skills, availability, preferences, feedback, client needs, history) and schedule outcomes (fill rates, travel time, satisfaction). This is a foundational first step for any "self-improvement."
    *   [ ] **Feedback Loops:** Design mechanisms for human schedulers to provide explicit feedback on algorithm suggestions and profile data accuracy.
    *   [ ] **Basic Analytics & Heuristics:** Develop dashboards for insights into collected data. Start with heuristic improvements to scoring or matching based on observed patterns.
    *   [ ] **Advanced Learning (Future Phase):** Explore ML models for predictive matching, algorithm parameter tuning, or learning better heuristics from data.

#### Notes on Self-Improving Mechanisms:
*   **Complexity:** True "self-improvement" is an advanced, iterative R&D effort.
*   **Algorithm Self-Improvement:**
    *   **Parameter Tuning:** The optimizer's behavior can be tuned by adjusting constraint weights or scoring in `sort_by_assignment_difficulty` based on performance metrics.
    *   **Learning Heuristics:** Analyze historical data (successful/failed assignments, human overrides) to learn better client/caregiver prioritization.
*   **Profile Self-Improvement:**
    *   **Dynamic Data:** Profiles should not be static. Augment them with learned insights (e.g., inferred skills from job history, true preferences from accepted/rejected shifts, client feedback trends).
    *   **Suggestion Engine:** The system could suggest updates to profiles based on observed data (e.g., "Caregiver X often works with dementia clients successfully, suggest adding 'dementia care' skill?").
*   **Phased Approach:**
    1.  **Data Logging:** Robustly log all relevant data.
    2.  **Analytics & Dashboards:** Provide visibility into performance and data trends.
    3.  **Rule-Based/Heuristic Enhancements:** Implement simple improvements based on analytics.
    4.  **ML Exploration:** Investigate more complex ML models if simpler approaches yield diminishing returns.

### Notes on Algorithm (as provided):
*   The `can_accept_client` constraint `projected_hours < 16` might be too restrictive early on. A position is typically built up. Final validation of a position (`all_constraints_satisfied`) correctly checks `position.total_hours >= 16`.
*   The `working_days` calculation is simplified (sum of client days). A real system would need to manage actual day overlaps or specific day assignments.
*   The `post_optimization_merge` is a placeholder and a significant area for future development to further optimize caregiver count.
*   "Self-improving" aspects are conceptual and would require additional systems beyond this core assignment logic (e.g., machine learning models, feedback mechanisms).
*   Added some minor fixes and robustness checks to the algorithm during review for this markdown.
*   The handling of clients with 0 hours needs business clarification.
*   The splitting logic in `handle_mandatory_splits` aims to distribute hours and days but could be refined. It currently pre-forms positions for these splits.
*   The re-ID of positions in `validate_and_return_solution` is good for clean output.
*   The main loop in `constraint_satisfaction_algorithm` trying `target_caregivers` will return the first solution it finds, which is guaranteed to be minimal in terms of number of caregivers *because it starts checking from the theoretical minimum*.

This document will be updated as development progresses.

## UI/UX Overhaul Plan (Phase 1: Calendar & Scheduling View)

This section outlines the conceptual changes for the scheduling system's user experience, focusing on the new calendar view and related functionalities. Implementation will primarily target the `frontend/` React application.

**1. Main Calendar View (`NewCalendarView.jsx` - to be created):**

*   **Layout:**
    *   A full-screen or large-pane calendar display (e.g., using a library like `FullCalendar` or a custom-built grid).
    *   Default view: Weekly or Monthly. Ability to switch between Day, Week, Month views.
    *   Navigation: Arrows for previous/next period, "Today" button.
*   **Event Display:**
    *   Each event on the calendar will represent a client shift or a block of time assigned to a caregiver.
    *   Information displayed directly on the event block:
        *   Client Name (or initials/ID if space is tight).
        *   Caregiver Name (or initials/ID).
        *   Time of shift.
        *   Brief status indicator (e.g., color-coded: confirmed, pending, issue).
    *   Clicking an event should open a modal or sidebar with detailed shift information (full client & caregiver details, notes, required skills, address).
*   **Filtering & Views:**
    *   **Primary Filter/View Mode:**
        *   "View by Caregiver": Calendar lanes/columns could represent individual caregivers, showing their schedules.
        *   "View by Client": Calendar lanes/columns could represent individual clients, showing who is scheduled for them. (This is a key V2 requirement).
        *   "Overall View": A combined view, perhaps color-coding events by caregiver or client.
    *   **Client Filter Dropdown:** A multi-select dropdown to filter the calendar to show schedules ONLY for the selected client(s). When a client is selected, the calendar should dynamically update.
    *   **Caregiver Filter Dropdown:** A multi-select dropdown to filter by specific caregivers.
    *   **Status Filter:** Filter by shift status (e.g., show only "unassigned shifts", "pending confirmation", "active").
    *   **Date Range Picker:** For selecting custom date ranges beyond simple next/prev navigation.

**2. Displaying Actively Working Caregivers:**

*   When "View by Caregiver" is active, or through a dedicated "Active Caregivers" list sidebar:
    *   List all caregivers who have scheduled shifts within the current view (day/week/month).
    *   Clicking a caregiver in this list could highlight their shifts on the calendar or filter the calendar to just their schedule.

**3. Section for Newly Onboarded / Unassigned Caregivers (`UnassignedCaregiversPanel.jsx` - to be created/integrated):**

*   **Purpose:** To highlight caregivers who are available but don't have (enough) cases.
*   **Display:**
    *   A separate panel or a section within the main scheduling dashboard.
    *   Lists caregivers who:
        *   Are marked as "active" or "available for new cases".
        *   Have zero or few scheduled hours in the upcoming period (e.g., next 1-2 weeks).
        *   Could be sorted by onboarding date (newest first) or availability.
    *   Information for each caregiver: Name, skills, general availability, contact.
    *   Action buttons: "View Profile", "Find Potential Matches" (could trigger a backend search for suitable unassigned clients/shifts).

**4. Data Flow & Backend Interaction:**

*   The calendar components will fetch schedule data from Firebase via `firebaseService.js` and potentially new methods in `enhanced-scheduler.js` (e.g., to get schedules within a date range, filtered by client/caregiver).
*   Real-time updates (`real-time-updates.js`) should refresh the calendar view when schedules change.
*   The new `getOptimizedSchedule` method in `enhanced-scheduler.js` (which calls the Python optimizer) will be invoked from a UI section dedicated to running new bulk schedule optimizations, likely separate from the direct calendar view but providing data *for* it.

**5. Uniformity and Consistency:**

*   **Styling:** Adhere to a common style guide. If one doesn't exist, propose a simple one (colors, fonts, spacing). Reuse existing UI components from `frontend/src/components/` where possible.
*   **Component Design:** Break down complex views into smaller, reusable components.
*   **State Management:** Utilize existing state management patterns (if any, e.g., React Context, Redux) or propose a simple one for managing calendar state, filters, and loaded data.

**Next Steps for UI/UX (Implementation - Phased):**

1.  **Setup Basic Calendar:**
    *   Choose and integrate a calendar library (e.g., `react-big-calendar`, `FullCalendar`) or start a custom grid for `NewCalendarView.jsx`.
    *   Fetch and display existing schedule data as events.
2.  **Implement Client Filtering:** Add the client filter dropdown and logic to update the displayed events.
3.  **Implement "View by Client" mode.**
4.  **Develop `UnassignedCaregiversPanel.jsx`** and integrate it.
5.  Iteratively add other filters, views, and polish.

This conceptual outline will be used to guide the actual coding changes for the UI.

## Group Chat Functionality Plan

This section outlines the plan for implementing group chat functionality for office staff, with potential LLM integration for awareness.

**1. Core Requirements:**

*   **User-to-User and Group Chat:** Allow office staff (users with appropriate roles) to create/join group chat channels and send direct messages to each other.
*   **Real-time Messaging:** Messages should appear in real-time for all participants in a channel/DM.
*   **Channel Management:**
    *   Ability to create public or private channels (e.g., "Scheduling Team", "Client Intake Q&A").
    *   Ability to invite users to private channels.
    *   List available channels.
*   **Message History:** Persist chat history for channels and DMs.
*   **User Interface (`GroupChatView.jsx` - new or enhance `AgentChat.jsx`):**
    *   A dedicated chat panel or view.
    *   Channel/DM list sidebar.
    *   Main message display area.
    *   Message input field.
    *   Display user avatars/names next to messages.
    *   Timestamps for messages.
    *   (Optional) Read receipts, typing indicators.

**2. Technology Choices & Backend:**

*   **Firebase for Real-time:** Firebase (Firestore or Realtime Database) is already in use and is well-suited for real-time chat applications.
    *   **Data Model (Firestore Example):**
        *   `chat_channels` collection:
            *   Fields: `name`, `description`, `type` (public/private), `members` (array of user IDs), `createdAt`, `lastMessageAt`.
        *   `messages` subcollection under each channel document:
            *   Fields: `senderId`, `senderName`, `text`, `timestamp`, `llmAnnotation` (optional).
        *   `direct_messages` collection (for 1-on-1 chats, could structure with composite IDs for conversations).
*   **Backend Logic (`chatService.js` - new, in `services/` or `frontend/src/services/`):**
    *   Functions to:
        *   Create/list channels.
        *   Add/remove users from channels.
        *   Send/receive messages (publish to Firebase).
        *   Fetch message history with pagination.
        *   Set up real-time listeners for new messages.

**3. LLM Integration for Awareness (Conceptual):**

*   **Purpose:** The LLM can "observe" chat conversations (with appropriate privacy considerations and user consent if necessary) to provide awareness or insights.
*   **Mechanism:**
    *   **Asynchronous Processing:** After a message is sent by a human, a Firebase Function could be triggered.
    *   This Function sends the message content (and potentially some context from the channel/conversation) to an LLM (e.g., via the existing `python_agent/main.py` or a dedicated LLM service).
    *   **LLM Task:** The LLM could be prompted to:
        *   Identify key topics, entities (client names, caregiver IDs mentioned).
        *   Detect sentiment or urgency.
        *   Recognize potential scheduling conflicts or opportunities mentioned in chat.
        *   Summarize discussions.
    *   **Storing Insights:** The LLM's output (e.g., tags, summary, identified entities) could be stored back in Firebase, possibly as an `llmAnnotation` field on the message document or in a separate related collection.
*   **UI for LLM Insights:**
    *   Subtle indicators on messages that have been processed/annotated by the LLM.
    *   A separate "Channel Insights" panel where summaries or trends identified by the LLM could be displayed.
    *   **Important:** This should be non-intrusive and clearly indicate AI-generated content. The primary focus is human-to-human chat.

**4. Integration with Existing `AgentChat.jsx`:**

*   Evaluate `frontend/src/components/AgentChat.jsx`.
*   If it's primarily for 1-on-1 with an AI agent, it might serve as a starting point for the DM UI, or a new `GroupChatView.jsx` could be created that incorporates some of its elements for the message display and input.
*   The V2 group chat needs a robust channel list and user management not typically present in simple agent chat UIs.

**5. Phased Implementation:**

1.  **Basic DM and Group Chat Backend:**
    *   Set up Firebase data structures for channels and messages.
    *   Implement `chatService.js` methods for sending/receiving messages in a single hardcoded test channel.
2.  **Basic Chat UI:**
    *   Create `GroupChatView.jsx` with message display and input for the test channel.
3.  **Channel Management:**
    *   Implement UI and backend logic for creating, listing, and joining channels.
4.  **DM Functionality:** Add 1-on-1 direct messaging.
5.  **Polish:** Typing indicators, read receipts, user profiles in chat.
6.  **LLM Awareness (Post-Core Chat):**
    *   Develop Firebase Function trigger for LLM processing.
    *   Integrate LLM call for simple annotation (e.g., topic tagging).
    *   Display LLM insights subtly in the UI.

This plan provides a roadmap for developing the group chat feature.
