-- Create class_collaborators table for co-teacher functionality
CREATE TABLE IF NOT EXISTS class_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor')),
  permissions JSONB DEFAULT '{}',
  
  -- Invitation tracking fields
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  invitation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'revoked')),
  invitation_token UUID DEFAULT gen_random_uuid() UNIQUE,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Ensure a teacher can only be invited once per class
  CONSTRAINT unique_class_teacher UNIQUE (class_id, teacher_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_class_collaborators_class_id ON class_collaborators(class_id);
CREATE INDEX idx_class_collaborators_teacher_id ON class_collaborators(teacher_id);
CREATE INDEX idx_class_collaborators_invitation_token ON class_collaborators(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX idx_class_collaborators_status ON class_collaborators(invitation_status);
CREATE INDEX idx_class_collaborators_active ON class_collaborators(class_id, teacher_id) 
  WHERE invitation_status = 'accepted' AND revoked_at IS NULL;

-- Comments for documentation
COMMENT ON TABLE class_collaborators IS 'Tracks co-teachers and their permissions for classes';
COMMENT ON COLUMN class_collaborators.role IS 'Role of the collaborator: viewer (read-only) or editor (can modify)';
COMMENT ON COLUMN class_collaborators.permissions IS 'JSON object containing specific permissions (e.g., {"can_manage_students": true})';
COMMENT ON COLUMN class_collaborators.invitation_status IS 'Current status of the invitation: pending, accepted, declined, or revoked';

-- Create function to check if a user has access to a class (owner or accepted collaborator)
CREATE OR REPLACE FUNCTION has_class_access(p_teacher_id UUID, p_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- Check if user is the class owner
    SELECT 1 FROM classes 
    WHERE id = p_class_id AND teacher_id = p_teacher_id
    
    UNION
    
    -- Check if user is an accepted collaborator
    SELECT 1 FROM class_collaborators
    WHERE class_id = p_class_id 
      AND teacher_id = p_teacher_id 
      AND invitation_status = 'accepted'
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if a user can edit a class (owner or editor collaborator)
CREATE OR REPLACE FUNCTION can_edit_class(p_teacher_id UUID, p_class_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    -- Check if user is the class owner
    SELECT 1 FROM classes 
    WHERE id = p_class_id AND teacher_id = p_teacher_id
    
    UNION
    
    -- Check if user is an editor collaborator
    SELECT 1 FROM class_collaborators
    WHERE class_id = p_class_id 
      AND teacher_id = p_teacher_id 
      AND role = 'editor'
      AND invitation_status = 'accepted'
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get a user's role in a class
CREATE OR REPLACE FUNCTION get_class_role(p_teacher_id UUID, p_class_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  -- Check if user is the owner
  IF EXISTS (SELECT 1 FROM classes WHERE id = p_class_id AND teacher_id = p_teacher_id) THEN
    RETURN 'owner';
  END IF;
  
  -- Check if user is a collaborator
  SELECT role INTO v_role
  FROM class_collaborators
  WHERE class_id = p_class_id 
    AND teacher_id = p_teacher_id 
    AND invitation_status = 'accepted'
    AND revoked_at IS NULL;
    
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check specific permission for a collaborator
CREATE OR REPLACE FUNCTION has_collaborator_permission(
  p_teacher_id UUID, 
  p_class_id UUID, 
  p_permission VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_permissions JSONB;
BEGIN
  -- Owners always have all permissions
  IF EXISTS (SELECT 1 FROM classes WHERE id = p_class_id AND teacher_id = p_teacher_id) THEN
    RETURN TRUE;
  END IF;
  
  -- Get collaborator permissions
  SELECT permissions INTO v_permissions
  FROM class_collaborators
  WHERE class_id = p_class_id 
    AND teacher_id = p_teacher_id 
    AND invitation_status = 'accepted'
    AND revoked_at IS NULL;
    
  -- Check if the specific permission exists and is true
  RETURN v_permissions IS NOT NULL AND (v_permissions->>p_permission)::BOOLEAN = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_class_collaborators_updated_at
  BEFORE UPDATE ON class_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();